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

function buildConversationTtsPrompt(item: any) {
  return `
Read the following university campus conversation aloud.

Audio style:
- Natural North American university setting
- Clear TOEFL-style listening pace
- Student sounds curious and slightly concerned
- Advisor sounds helpful and professional
- Do not read stage directions aloud
- Preserve the speaker turns

Transcript:
${item.transcript}
`;
}

function buildLectureTtsPrompt(item: any) {
  return `
Read the following academic lecture aloud.

Audio style:
- Natural North American university professor
- Clear TOEFL-style listening pace
- Informative, structured, and natural
- Do not add anything not in the transcript

Transcript:
${item.transcript}
`;
}

async function synthesizeListeningItem(ai: GoogleGenAI, item: any) {
  const isConversation = item.audioType === 'conversation';

  const response = await ai.models.generateContent({
    model: TTS_MODEL,
    contents: [
      {
        parts: [
          {
            text: isConversation
              ? buildConversationTtsPrompt(item)
              : buildLectureTtsPrompt(item),
          },
        ],
      },
    ],
    config: isConversation
      ? {
          responseModalities: ['AUDIO'],
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
                  speaker: 'Advisor',
                  voiceConfig: {
                    prebuiltVoiceConfig: {
                      voiceName: 'Kore',
                    },
                  },
                },
              ],
            },
          },
        }
      : {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Charon',
              },
            },
          },
        },
  });

  const audioBase64 = getInlineAudioBase64(response);

  if (!audioBase64) {
    throw new Error(`Gemini TTS returned no audio for ${item.id}.`);
  }

  const pcmBytes = base64ToUint8Array(audioBase64);
  return pcmToWavBytes(pcmBytes);
}

async function uploadAudio({
  supabaseAdmin,
  userId,
  attemptId,
  item,
  wavBytes,
}: {
  supabaseAdmin: ReturnType<typeof createClient>;
  userId: string;
  attemptId: string;
  item: any;
  wavBytes: Uint8Array;
}) {
  const audioPath = `${userId}/toefl-listening/${attemptId}/${item.id}.wav`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(AUDIO_BUCKET)
    .upload(audioPath, new Blob([wavBytes], { type: 'audio/wav' }), {
      contentType: 'audio/wav',
      upsert: true,
    });

  if (uploadError) {
    throw new Error(uploadError.message || `Failed to upload audio for ${item.id}.`);
  }

  const { data } = supabaseAdmin.storage.from(AUDIO_BUCKET).getPublicUrl(audioPath);

  return {
    audioPath,
    audioUrl: data.publicUrl,
  };
}

function updateItemAudioInContent(content: any, itemId: string, audio: any) {
  const items = Array.isArray(content?.content?.items)
    ? content.content.items
    : [];

  return {
    ...content,
    content: {
      ...(content?.content || {}),
      items: items.map((item: any) =>
        item.id === itemId
          ? {
              ...item,
              audioUrl: audio.audioUrl,
              audioPath: audio.audioPath,
            }
          : item
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
    const itemId = String(body.itemId || '').trim();

    if (!sectionId) {
      return new Response(JSON.stringify({ error: 'sectionId is required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!itemId) {
      return new Response(JSON.stringify({ error: 'itemId is required.' }), {
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
      .eq('section_key', 'listening')
      .single();

    if (sectionError || !section) {
      throw new Error(sectionError?.message || 'TOEFL Listening section not found.');
    }

    if (section.status !== 'in_progress') {
      throw new Error('This TOEFL Listening section is no longer in progress.');
    }

    const items = Array.isArray(section.content?.content?.items)
      ? section.content.content.items
      : [];

    const item = items.find((entry: any) => entry.id === itemId);

    if (!item) {
      throw new Error('Listening item not found.');
    }

    if (item.audioUrl && item.audioPath) {
      return new Response(
        JSON.stringify({
          item,
          audioUrl: item.audioUrl,
          audioPath: item.audioPath,
          section,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
    const wavBytes = await synthesizeListeningItem(ai, item);

    const audio = await uploadAudio({
      supabaseAdmin,
      userId: user.id,
      attemptId: section.attempt_id,
      item,
      wavBytes,
    });

    const updatedContent = updateItemAudioInContent(
      section.content,
      itemId,
      audio
    );

    const generatedItem = updatedContent.content.items.find(
      (entry: any) => entry.id === itemId
    );

    const { data: updatedSection, error: updateError } = await supabaseAdmin
      .from('exam_attempt_sections')
      .update({
        content: updatedContent,
        metadata: {
          ...(section.metadata || {}),
          last_audio_generated_at: new Date().toISOString(),
          audio_generation: 'on_demand',
          generated_audio_item_ids: [
            ...new Set([
              ...((section.metadata || {}).generated_audio_item_ids || []),
              itemId,
            ]),
          ],
        },
      })
      .eq('id', section.id)
      .eq('user_id', user.id)
      .select('*')
      .single();

    if (updateError) {
      throw new Error(updateError.message || 'Failed to update Listening audio.');
    }

    return new Response(
      JSON.stringify({
        item: generatedItem,
        audioUrl: audio.audioUrl,
        audioPath: audio.audioPath,
        section: updatedSection,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('TOEFL Listening audio generation error:', error);

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'Unknown TOEFL Listening audio generation error.',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});