import { supabase } from '../supabase';

export async function startToeflReadingAttempt() {
  const { data, error } = await supabase.functions.invoke(
    'ai-toefl-reading-generate',
    {
      body: {},
    }
  );

  if (error) {
    throw new Error(error.message || 'Failed to generate TOEFL Reading.');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}

export async function startToeflListeningAttempt() {
  const { data, error } = await supabase.functions.invoke(
    'ai-toefl-listening-generate',
    {
      body: {},
    }
  );

  if (error) {
    throw new Error(error.message || 'Failed to generate TOEFL Listening.');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}

export async function startToeflWritingAttempt() {
  const { data, error } = await supabase.functions.invoke(
    'ai-toefl-writing-generate',
    {
      body: {},
    }
  );

  if (error) {
    throw new Error(error.message || 'Failed to generate TOEFL Writing.');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}

export async function startToeflSpeakingAttempt() {
  const { data, error } = await supabase.functions.invoke(
    'ai-toefl-speaking-generate',
    {
      body: {},
    }
  );

  if (error) {
    throw new Error(error.message || 'Failed to generate TOEFL Speaking.');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}

export async function generateToeflListeningAudio({ sectionId, itemId }) {
  const { data, error } = await supabase.functions.invoke(
    'ai-toefl-listening-audio-generate',
    {
      body: {
        sectionId,
        itemId,
      },
    }
  );

  if (error) {
    throw new Error(error.message || 'Failed to generate TOEFL Listening audio.');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}

export async function generateToeflSpeakingStimulusAudio({ sectionId, taskId }) {
  const { data, error } = await supabase.functions.invoke(
    'ai-toefl-speaking-stimulus-audio-generate',
    {
      body: {
        sectionId,
        taskId,
      },
    }
  );

  if (error) {
    throw new Error(
      error.message || 'Failed to generate TOEFL Speaking stimulus audio.'
    );
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}

export async function uploadToeflSpeakingAudio({
  sectionId,
  taskId,
  audioBlob,
  durationSec,
}) {
  const formData = new FormData();

  formData.append('sectionId', sectionId);
  formData.append('taskId', taskId);
  formData.append('durationSec', String(durationSec || 0));
  formData.append('audio', audioBlob, `${taskId}.webm`);

  const { data, error } = await supabase.functions.invoke(
    'ai-toefl-speaking-audio-upload',
    {
      body: formData,
    }
  );

  if (error) {
    throw new Error(error.message || 'Failed to upload TOEFL Speaking audio.');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}

export async function getLatestInProgressToeflReadingSection() {
  const { data, error } = await supabase
    .from('exam_attempt_sections')
    .select('*')
    .eq('exam_key', 'toefl_ibt')
    .eq('section_key', 'reading')
    .eq('status', 'in_progress')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || 'Failed to load saved TOEFL Reading attempt.');
  }

  return data || null;
}

export async function getLatestInProgressToeflListeningSection() {
  const { data, error } = await supabase
    .from('exam_attempt_sections')
    .select('*')
    .eq('exam_key', 'toefl_ibt')
    .eq('section_key', 'listening')
    .eq('status', 'in_progress')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || 'Failed to load saved TOEFL Listening attempt.');
  }

  return data || null;
}

export async function getLatestInProgressToeflWritingSection() {
  const { data, error } = await supabase
    .from('exam_attempt_sections')
    .select('*')
    .eq('exam_key', 'toefl_ibt')
    .eq('section_key', 'writing')
    .eq('status', 'in_progress')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || 'Failed to load saved TOEFL Writing attempt.');
  }

  return data || null;
}

export async function getLatestInProgressToeflSpeakingSection() {
  const { data, error } = await supabase
    .from('exam_attempt_sections')
    .select('*')
    .eq('exam_key', 'toefl_ibt')
    .eq('section_key', 'speaking')
    .eq('status', 'in_progress')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || 'Failed to load saved TOEFL Speaking attempt.');
  }

  return data || null;
}

export async function getExamAttemptWithSections(attemptId) {
  const { data: attempt, error: attemptError } = await supabase
    .from('exam_attempts')
    .select('*')
    .eq('id', attemptId)
    .single();

  if (attemptError) {
    throw new Error(attemptError.message || 'Failed to load exam attempt.');
  }

  const { data: sections, error: sectionsError } = await supabase
    .from('exam_attempt_sections')
    .select('*')
    .eq('attempt_id', attemptId)
    .order('created_at', { ascending: true });

  if (sectionsError) {
    throw new Error(sectionsError.message || 'Failed to load exam sections.');
  }

  return {
    attempt,
    sections: sections || [],
  };
}

export async function saveToeflReadingProgress({
  sectionId,
  answers,
  remainingSeconds,
}) {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('exam_attempt_sections')
    .update({
      answers,
      metadata: {
        remaining_seconds: remainingSeconds,
        last_saved_at: now,
        autosaved: true,
      },
    })
    .eq('id', sectionId)
    .eq('status', 'in_progress')
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message || 'Failed to save TOEFL Reading progress.');
  }

  return data;
}

export async function saveToeflListeningProgress({
  sectionId,
  answers,
  remainingSeconds,
  playedItemIds,
  currentItemIndex,
  notes,
}) {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('exam_attempt_sections')
    .update({
      answers,
      metadata: {
        remaining_seconds: remainingSeconds,
        played_item_ids: playedItemIds,
        current_item_index: currentItemIndex,
        notes,
        last_saved_at: now,
        autosaved: true,
      },
    })
    .eq('id', sectionId)
    .eq('status', 'in_progress')
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message || 'Failed to save TOEFL Listening progress.');
  }

  return data;
}

export async function saveToeflWritingProgress({
  sectionId,
  answers,
  remainingSeconds,
  currentTaskIndex,
}) {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('exam_attempt_sections')
    .update({
      answers,
      metadata: {
        remaining_seconds: remainingSeconds,
        current_task_index: currentTaskIndex,
        last_saved_at: now,
        autosaved: true,
      },
    })
    .eq('id', sectionId)
    .eq('status', 'in_progress')
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message || 'Failed to save TOEFL Writing progress.');
  }

  return data;
}

export async function saveToeflSpeakingProgress({
  sectionId,
  remainingSeconds,
  currentTaskIndex,
  stimulusPlayedTaskIds,
}) {
  const now = new Date().toISOString();

  const { data: currentSection, error: currentError } = await supabase
    .from('exam_attempt_sections')
    .select('metadata')
    .eq('id', sectionId)
    .eq('status', 'in_progress')
    .single();

  if (currentError) {
    throw new Error(currentError.message || 'Failed to load TOEFL Speaking metadata.');
  }

  const nextMetadata = {
    ...(currentSection?.metadata || {}),
    remaining_seconds: remainingSeconds,
    current_task_index: currentTaskIndex,
    last_saved_at: now,
    autosaved: true,
  };

  if (Array.isArray(stimulusPlayedTaskIds)) {
    nextMetadata.stimulus_played_task_ids = stimulusPlayedTaskIds;
  }

  const { data, error } = await supabase
    .from('exam_attempt_sections')
    .update({
      metadata: nextMetadata,
    })
    .eq('id', sectionId)
    .eq('status', 'in_progress')
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message || 'Failed to save TOEFL Speaking progress.');
  }

  return data;
}

export async function abandonToeflReadingAttempt(section) {
  if (!section?.id || !section?.attempt_id) {
    throw new Error('Missing TOEFL Reading section.');
  }

  const now = new Date().toISOString();

  const { data: abandonedSection, error: sectionError } = await supabase
    .from('exam_attempt_sections')
    .update({
      status: 'abandoned',
      completed_at: now,
      metadata: {
        ...(section.metadata || {}),
        abandoned_at: now,
      },
    })
    .eq('id', section.id)
    .eq('status', 'in_progress')
    .select('*')
    .single();

  if (sectionError) {
    throw new Error(sectionError.message || 'Failed to abandon TOEFL Reading.');
  }

  const { error: attemptError } = await supabase
    .from('exam_attempts')
    .update({
      status: 'abandoned',
      completed_at: now,
      metadata: {
        abandoned_section: 'reading',
        abandoned_at: now,
      },
    })
    .eq('id', section.attempt_id)
    .eq('status', 'in_progress');

  if (attemptError) {
    throw new Error(attemptError.message || 'Failed to abandon TOEFL attempt.');
  }

  return abandonedSection;
}

export async function abandonToeflListeningAttempt(section) {
  if (!section?.id || !section?.attempt_id) {
    throw new Error('Missing TOEFL Listening section.');
  }

  const now = new Date().toISOString();

  const { data: abandonedSection, error: sectionError } = await supabase
    .from('exam_attempt_sections')
    .update({
      status: 'abandoned',
      completed_at: now,
      metadata: {
        ...(section.metadata || {}),
        abandoned_at: now,
      },
    })
    .eq('id', section.id)
    .eq('status', 'in_progress')
    .select('*')
    .single();

  if (sectionError) {
    throw new Error(sectionError.message || 'Failed to abandon TOEFL Listening.');
  }

  const { error: attemptError } = await supabase
    .from('exam_attempts')
    .update({
      status: 'abandoned',
      completed_at: now,
      metadata: {
        abandoned_section: 'listening',
        abandoned_at: now,
      },
    })
    .eq('id', section.attempt_id)
    .eq('status', 'in_progress');

  if (attemptError) {
    throw new Error(attemptError.message || 'Failed to abandon TOEFL attempt.');
  }

  return abandonedSection;
}

export async function abandonToeflWritingAttempt(section) {
  if (!section?.id || !section?.attempt_id) {
    throw new Error('Missing TOEFL Writing section.');
  }

  const now = new Date().toISOString();

  const { data: abandonedSection, error: sectionError } = await supabase
    .from('exam_attempt_sections')
    .update({
      status: 'abandoned',
      completed_at: now,
      metadata: {
        ...(section.metadata || {}),
        abandoned_at: now,
      },
    })
    .eq('id', section.id)
    .eq('status', 'in_progress')
    .select('*')
    .single();

  if (sectionError) {
    throw new Error(sectionError.message || 'Failed to abandon TOEFL Writing.');
  }

  const { error: attemptError } = await supabase
    .from('exam_attempts')
    .update({
      status: 'abandoned',
      completed_at: now,
      metadata: {
        abandoned_section: 'writing',
        abandoned_at: now,
      },
    })
    .eq('id', section.attempt_id)
    .eq('status', 'in_progress');

  if (attemptError) {
    throw new Error(attemptError.message || 'Failed to abandon TOEFL attempt.');
  }

  return abandonedSection;
}

export async function abandonToeflSpeakingAttempt(section) {
  if (!section?.id || !section?.attempt_id) {
    throw new Error('Missing TOEFL Speaking section.');
  }

  const now = new Date().toISOString();

  const { data: abandonedSection, error: sectionError } = await supabase
    .from('exam_attempt_sections')
    .update({
      status: 'abandoned',
      completed_at: now,
      metadata: {
        ...(section.metadata || {}),
        abandoned_at: now,
      },
    })
    .eq('id', section.id)
    .eq('status', 'in_progress')
    .select('*')
    .single();

  if (sectionError) {
    throw new Error(sectionError.message || 'Failed to abandon TOEFL Speaking.');
  }

  const { error: attemptError } = await supabase
    .from('exam_attempts')
    .update({
      status: 'abandoned',
      completed_at: now,
      metadata: {
        abandoned_section: 'speaking',
        abandoned_at: now,
      },
    })
    .eq('id', section.attempt_id)
    .eq('status', 'in_progress');

  if (attemptError) {
    throw new Error(attemptError.message || 'Failed to abandon TOEFL attempt.');
  }

  return abandonedSection;
}

export async function evaluateToeflReadingSection({ sectionId, answers }) {
  const { data, error } = await supabase.functions.invoke(
    'ai-toefl-reading-evaluate',
    {
      body: {
        sectionId,
        answers,
      },
    }
  );

  if (error) {
    throw new Error(error.message || 'Failed to evaluate TOEFL Reading.');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data.result;
}

export async function evaluateToeflListeningSection({ sectionId, answers }) {
  const { data, error } = await supabase.functions.invoke(
    'ai-toefl-listening-evaluate',
    {
      body: {
        sectionId,
        answers,
      },
    }
  );

  if (error) {
    throw new Error(error.message || 'Failed to evaluate TOEFL Listening.');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data.result;
}

export async function evaluateToeflWritingSection({ sectionId, answers }) {
  const { data, error } = await supabase.functions.invoke(
    'ai-toefl-writing-evaluate',
    {
      body: {
        sectionId,
        answers,
      },
    }
  );

  if (error) {
    throw new Error(error.message || 'Failed to evaluate TOEFL Writing.');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data.result;
}

export async function evaluateToeflSpeakingSection({ sectionId }) {
  const { data, error } = await supabase.functions.invoke(
    'ai-toefl-speaking-evaluate',
    {
      body: {
        sectionId,
      },
    }
  );

  if (error) {
    throw new Error(error.message || 'Failed to evaluate TOEFL Speaking.');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data.result;
}