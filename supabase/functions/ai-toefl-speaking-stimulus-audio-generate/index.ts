import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { GoogleGenAI } from 'npm:@google/genai';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const TTS_MODEL = 'gemini-2.5-flash-preview-tts';
const AUDIO_BUCKET = 'exam-audio';

function base64ToUint8Array(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function writeString(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function pcmToWavBytes(pcmBytes: Uint8Array, sampleRate = 24000, channels = 1) {
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = channels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const wavBytes = new Uint8Array(44 + pcmBytes.length);
  const view = new DataView(wavBytes.buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + pcmBytes.length, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, pcmBytes.length, true);
  wavBytes.set(pcmBytes, 44);

  return wavBytes;
}

function getInlineAudioBase64(response: any) {
  const parts = response?.candidates?.[0]?.content?.parts || [];

  const audioPart = parts.find(
    (part: any) => part?.inlineData?.data || part?.inline_data?.data
  );

  return audioPart?.inlineData?.data || audioPart?.inline_data?.data || '';
}

function isCampusConversationTask(task: any) {
  return (
    task?.taskType === 'integrated_campus' ||
    String(task?.taskType || '').toLowerCase().includes('campus')
  );
}

function cleanTranscriptLine(line: string) {
  return String(line || '')
    .trim()
    .replace(/^[-*]\s+/, '')
    .trim();
}

function isStageDirection(line: string) {
  const value = String(line || '').trim();

  return (
    /^\[.*\]$/.test(value) ||
    /^\(.*\)$/.test(value) ||
    /^stage direction/i.test(value)
  );
}

function mapSpeakerName(rawSpeaker: string, fallbackIndex: number) {
  const speaker = String(rawSpeaker || '').toLowerCase();

  if (
    speaker.includes('student') ||
    speaker.includes('learner') ||
    speaker.includes('undergraduate')
  ) {
    return 'Student';
  }

  if (
    speaker.includes('professor') ||
    speaker.includes('teacher') ||
    speaker.includes('advisor') ||
    speaker.includes('adviser') ||
    speaker.includes('administrator') ||
    speaker.includes('staff') ||
    speaker.includes('librarian') ||
    speaker.includes('counselor') ||
    speaker.includes('counsellor') ||
    speaker.includes('employee') ||
    speaker.includes('clerk') ||
    speaker.includes('assistant')
  ) {
    return 'UniversityStaff';
  }

  return fallbackIndex === 0 ? 'Student' : 'UniversityStaff';
}

function normalizeCampusTranscript(transcript: string) {
  const lines = String(transcript || '')
    .split('\n')
    .map(cleanTranscriptLine)
    .filter(Boolean)
    .filter((line) => !isStageDirection(line));

  const speakerNames: string[] = [];

  lines.forEach((line) => {
    const match = line.match(/^([A-Za-z][A-Za-z\s.-]{0,40}):\s*(.+)$/);

    if (!match) return;

    const rawSpeaker = match[1].trim();

    if (!speakerNames.includes(rawSpeaker)) {
      speakerNames.push(rawSpeaker);
    }
  });

  const speakerMap = new Map<string, string>();

  speakerNames.forEach((speakerName, index) => {
    speakerMap.set(speakerName, mapSpeakerName(speakerName, index));
  });

  const normalizedLines = lines.map((line) => {
    const match = line.match(/^([A-Za-z][A-Za-z\s.-]{0,40}):\s*(.+)$/);

    if (!match) {
      return line;
    }

    const rawSpeaker = match[1].trim();
    const spokenText = match[2].trim();
    const mappedSpeaker = speakerMap.get(rawSpeaker) || 'UniversityStaff';

    return `${mappedSpeaker}: ${spokenText}`;
  });

  const normalizedTranscript = normalizedLines.join('\n');
  const hasStudent = /^Student:/m.test(normalizedTranscript);
  const hasUniversityStaff = /^UniversityStaff:/m.test(normalizedTranscript);

  return {
    transcript: normalizedTranscript,
    canUseMultiSpeaker: hasStudent && hasUniversityStaff,
  };
}

function buildSingleSpeakerStimulusPrompt(task: any) {
  const isCampus = isCampusConversationTask(task);

  return `
Read this TOEFL iBT Speaking stimulus audio aloud.

Task type: ${task.taskType}

Style:
- Natural North American university English
- Clear TOEFL-style pace
- Do not read stage directions aloud
- Do not add anything not in the transcript
- Sound natural, but keep pronunciation clear
${
  isCampus
    ? '- Campus conversation style, with realistic student/university context'
    : '- Academic lecture style, with a professor explaining clearly'
}

Transcript:
${task.listeningTranscript}
`;
}

function buildCampusConversationStimulusPrompt(task: any, normalizedTranscript: string) {
  return `
Read this TOEFL iBT Speaking Task 2 campus conversation aloud.

Use exactly two speakers:
- Student: a young university student
- UniversityStaff: a university professor, advisor, or staff member

Rules:
- Use the speaker labels only to assign voices.
- Do not read the speaker labels aloud.
- Do not read stage directions aloud.
- Do not add anything not in the transcript.
- Keep a natural TOEFL campus conversation pace.
- Student and UniversityStaff must sound clearly different.

Transcript:
${normalizedTranscript}
`;
}

async function generateAudioBytes({
  ai,
  prompt,
  speechConfig,
}: {
  ai: GoogleGenAI;
  prompt: string;
  speechConfig: any;
}) {
  const response = await ai.models.generateContent({
    model: TTS_MODEL,
    contents: [
      {
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig,
    },
  });

  const audioBase64 = getInlineAudioBase64(response);

  if (!audioBase64) {
    throw new Error('Gemini TTS returned no audio.');
  }

  const pcmBytes = base64ToUint8Array(audioBase64);
  return pcmToWavBytes(pcmBytes);
}

async function synthesizeCampusConversationAudio(
  ai: GoogleGenAI,
  task: any,
  normalizedTranscript: string
) {
  return generateAudioBytes({
    ai,
    prompt: buildCampusConversationStimulusPrompt(task, normalizedTranscript),
    speechConfig: {
      multiSpeakerVoiceConfig: {
        speakerVoiceConfigs: [
          {
            speaker: 'Student',
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Puck',
              },
            },
          },
          {
            speaker: 'UniversityStaff',
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Charon',
              },
            },
          },
        ],
      },
    },
  });
}

async function synthesizeSingleSpeakerStimulusAudio(ai: GoogleGenAI, task: any) {
  const isCampus = isCampusConversationTask(task);

  return generateAudioBytes({
    ai,
    prompt: buildSingleSpeakerStimulusPrompt(task),
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: isCampus ? 'Puck' : 'Charon',
        },
      },
    },
  });
}

async function synthesizeStimulusAudio(ai: GoogleGenAI, task: any) {
  const isCampus = isCampusConversationTask(task);

  if (isCampus) {
    const normalized = normalizeCampusTranscript(task.listeningTranscript);

    if (normalized.canUseMultiSpeaker) {
      try {
        return await synthesizeCampusConversationAudio(
          ai,
          task,
          normalized.transcript
        );
      } catch (error) {
        console.error(
          'Multi-speaker TTS failed, falling back to single speaker:',
          error
        );
      }
    } else {
      console.warn(
        `Campus task ${task.id} does not contain clear Student/UniversityStaff speaker labels. Falling back to single-speaker TTS.`
      );
    }
  }

  return synthesizeSingleSpeakerStimulusAudio(ai, task);
}

function updateTaskStimulusAudio({
  content,
  taskId,
  stimulusAudioUrl,
  stimulusAudioPath,
}: {
  content: any;
  taskId: string;
  stimulusAudioUrl: string;
  stimulusAudioPath: string;
}) {
  const tasks = Array.isArray(content?.content?.tasks)
    ? content.content.tasks
    : [];

  return {
    ...content,
    content: {
      ...(content?.content || {}),
      tasks: tasks.map((task: any) =>
        task.id === taskId
          ? {
              ...task,
              stimulusAudioUrl,
              stimulusAudioPath,
              stimulusMimeType: 'audio/wav',
              stimulusGeneratedAt: new Date().toISOString(),
            }
          : task
      ),
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed.' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      throw new Error('Missing Supabase environment variables.');
    }

    if (!geminiApiKey) {
      throw new Error('Missing GEMINI_API_KEY secret.');
    }

    const authorization = req.headers.get('Authorization') || '';

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authorization },
      },
    });

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();

    const sectionId = String(body.sectionId || '').trim();
    const taskId = String(body.taskId || '').trim();
    const force = Boolean(body.force);

    if (!sectionId) {
      return new Response(JSON.stringify({ error: 'sectionId is required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!taskId) {
      return new Response(JSON.stringify({ error: 'taskId is required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: section, error: sectionError } = await supabaseAdmin
      .from('exam_attempt_sections')
      .select('*')
      .eq('id', sectionId)
      .eq('user_id', user.id)
      .eq('exam_key', 'toefl_ibt')
      .eq('section_key', 'speaking')
      .single();

    if (sectionError || !section) {
      throw new Error(sectionError?.message || 'TOEFL Speaking section not found.');
    }

    if (section.status !== 'in_progress') {
      throw new Error('This TOEFL Speaking section is no longer in progress.');
    }

    const tasks = Array.isArray(section.content?.content?.tasks)
      ? section.content.content.tasks
      : [];

    const task = tasks.find((entry: any) => entry.id === taskId);

    if (!task) {
      throw new Error('Speaking task not found.');
    }

    if (!task.listeningTranscript) {
      throw new Error('This speaking task has no stimulus audio to generate.');
    }

    if (!force && task.stimulusAudioUrl && task.stimulusAudioPath) {
      return new Response(
        JSON.stringify({
          task,
          stimulusAudioUrl: task.stimulusAudioUrl,
          stimulusAudioPath: task.stimulusAudioPath,
          section,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
    const wavBytes = await synthesizeStimulusAudio(ai, task);

    const stimulusAudioPath = `${user.id}/toefl-speaking/${section.attempt_id}/stimulus-${task.id}.wav`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(AUDIO_BUCKET)
      .upload(stimulusAudioPath, new Blob([wavBytes], { type: 'audio/wav' }), {
        contentType: 'audio/wav',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(uploadError.message || 'Failed to upload stimulus audio.');
    }

    const { data: publicData } = supabaseAdmin.storage
      .from(AUDIO_BUCKET)
      .getPublicUrl(stimulusAudioPath);

    const stimulusAudioUrl = publicData.publicUrl;

    const updatedContent = updateTaskStimulusAudio({
      content: section.content,
      taskId,
      stimulusAudioUrl,
      stimulusAudioPath,
    });

    const generatedStimulusTaskIds = [
      ...new Set([
        ...((section.metadata || {}).generated_stimulus_task_ids || []),
        taskId,
      ]),
    ];

    const { data: updatedSection, error: updateError } = await supabaseAdmin
      .from('exam_attempt_sections')
      .update({
        content: updatedContent,
        metadata: {
          ...(section.metadata || {}),
          generated_stimulus_task_ids: generatedStimulusTaskIds,
          last_stimulus_audio_generated_at: new Date().toISOString(),
        },
      })
      .eq('id', section.id)
      .eq('user_id', user.id)
      .select('*')
      .single();

    if (updateError) {
      throw new Error(updateError.message || 'Failed to update stimulus audio.');
    }

    const updatedTask = updatedContent.content.tasks.find(
      (entry: any) => entry.id === taskId
    );

    return new Response(
      JSON.stringify({
        task: updatedTask,
        stimulusAudioUrl,
        stimulusAudioPath,
        section: updatedSection,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('TOEFL Speaking stimulus audio generation error:', error);

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'Unknown TOEFL Speaking stimulus audio generation error.',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});