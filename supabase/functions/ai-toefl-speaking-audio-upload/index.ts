import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const AUDIO_BUCKET = 'exam-audio';

function updateTaskAudioInContent({
  content,
  taskId,
  audioUrl,
  audioPath,
  mimeType,
  durationSec,
}: {
  content: any;
  taskId: string;
  audioUrl: string;
  audioPath: string;
  mimeType: string;
  durationSec: number;
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
              responseAudioUrl: audioUrl,
              responseAudioPath: audioPath,
              responseMimeType: mimeType,
              responseDurationSec: durationSec,
            }
          : task
      ),
    },
  };
}

function buildAnswersPayload({
  currentAnswers,
  taskId,
  audioUrl,
  audioPath,
  mimeType,
  durationSec,
}: {
  currentAnswers: Record<string, unknown>;
  taskId: string;
  audioUrl: string;
  audioPath: string;
  mimeType: string;
  durationSec: number;
}) {
  return {
    ...(currentAnswers || {}),
    [taskId]: {
      audioUrl,
      audioPath,
      mimeType,
      durationSec,
      uploadedAt: new Date().toISOString(),
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

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      throw new Error('Missing Supabase environment variables.');
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

    const formData = await req.formData();

    const sectionId = String(formData.get('sectionId') || '').trim();
    const taskId = String(formData.get('taskId') || '').trim();
    const durationSec = Number(formData.get('durationSec') || 0);
    const audioFile = formData.get('audio');

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

    if (!(audioFile instanceof File)) {
      return new Response(JSON.stringify({ error: 'Audio file is required.' }), {
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

    const mimeType = audioFile.type || 'audio/webm';
    const extension =
      mimeType.includes('webm')
        ? 'webm'
        : mimeType.includes('mp4')
        ? 'mp4'
        : mimeType.includes('mpeg')
        ? 'mp3'
        : mimeType.includes('ogg')
        ? 'ogg'
        : 'wav';

    const audioPath = `${user.id}/toefl-speaking/${section.attempt_id}/${taskId}.${extension}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(AUDIO_BUCKET)
      .upload(audioPath, audioFile, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      throw new Error(uploadError.message || 'Failed to upload speaking audio.');
    }

    const { data: publicData } = supabaseAdmin.storage
      .from(AUDIO_BUCKET)
      .getPublicUrl(audioPath);

    const audioUrl = publicData.publicUrl;

    const updatedContent = updateTaskAudioInContent({
      content: section.content,
      taskId,
      audioUrl,
      audioPath,
      mimeType,
      durationSec,
    });

    const updatedAnswers = buildAnswersPayload({
      currentAnswers: section.answers || {},
      taskId,
      audioUrl,
      audioPath,
      mimeType,
      durationSec,
    });

    const recordedTaskIds = [
      ...new Set([
        ...((section.metadata || {}).recorded_task_ids || []),
        taskId,
      ]),
    ];

    const { data: updatedSection, error: updateError } = await supabaseAdmin
      .from('exam_attempt_sections')
      .update({
        content: updatedContent,
        answers: updatedAnswers,
        metadata: {
          ...(section.metadata || {}),
          recorded_task_ids: recordedTaskIds,
          last_audio_uploaded_at: new Date().toISOString(),
        },
      })
      .eq('id', section.id)
      .eq('user_id', user.id)
      .select('*')
      .single();

    if (updateError) {
      throw new Error(updateError.message || 'Failed to save speaking audio.');
    }

    const updatedTask = updatedContent.content.tasks.find(
      (entry: any) => entry.id === taskId
    );

    return new Response(
      JSON.stringify({
        task: updatedTask,
        audioUrl,
        audioPath,
        mimeType,
        durationSec,
        section: updatedSection,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('TOEFL Speaking audio upload error:', error);

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'Unknown TOEFL Speaking audio upload error.',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});