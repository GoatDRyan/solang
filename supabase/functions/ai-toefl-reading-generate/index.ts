import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { GoogleGenAI } from 'npm:@google/genai';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const QUESTION_TYPES = [
  'factual_information',
  'inference',
  'rhetorical_purpose',
  'negative_factual_information',
  'vocabulary_in_context',
  'sentence_simplification',
  'insert_text',
  'prose_summary',
];

function safeParseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const cleaned = text
      .replace(/^```json/i, '')
      .replace(/^```/i, '')
      .replace(/```$/i, '')
      .trim();

    return JSON.parse(cleaned);
  }
}

function normalizeOption(option: any, index: number) {
  const label = String(option?.label || String.fromCharCode(65 + index)).trim();
  const text =
    typeof option === 'string'
      ? option
      : String(option?.text || option?.option || option?.content || '').trim();

  return {
    label,
    text,
  };
}

function normalizeQuestion(question: any, passageIndex: number, questionIndex: number) {
  const type = QUESTION_TYPES.includes(question?.type)
    ? question.type
    : 'factual_information';

  const id =
    question?.id || `p${passageIndex + 1}_q${questionIndex + 1}`;

  const options = Array.isArray(question?.options)
    ? question.options.map(normalizeOption).filter((option: any) => option.text)
    : [];

  const isSummary = type === 'prose_summary';
  const isInsert = type === 'insert_text';

  const defaultOptions = isSummary
    ? ['A', 'B', 'C', 'D', 'E', 'F'].map((label) => ({
        label,
        text: `Summary option ${label}`,
      }))
    : ['A', 'B', 'C', 'D'].map((label) => ({
        label,
        text: `Option ${label}`,
      }));

  const finalOptions = options.length > 0 ? options : defaultOptions;

  const correctAnswers = Array.isArray(question?.correctAnswers)
    ? question.correctAnswers.map((item: any) => String(item).trim()).slice(0, 3)
    : Array.isArray(question?.answer)
    ? question.answer.map((item: any) => String(item).trim()).slice(0, 3)
    : [];

  const correctAnswer = String(
    question?.correctAnswer || question?.answer || finalOptions[0]?.label || 'A'
  ).trim();

  return {
    id,
    type,
    paragraphNumber:
      typeof question?.paragraphNumber === 'number'
        ? question.paragraphNumber
        : null,
    question:
      String(question?.question || question?.prompt || `Question ${questionIndex + 1}`).trim(),
    options: finalOptions,
    answerMode: isSummary ? 'multi_select' : 'single_choice',
    selectCount: isSummary ? 3 : 1,
    correctAnswer: isSummary ? null : correctAnswer,
    correctAnswers: isSummary
      ? correctAnswers.length === 3
        ? correctAnswers
        : finalOptions.slice(0, 3).map((option: any) => option.label)
      : [],
    sentenceToSimplify: question?.sentenceToSimplify
      ? String(question.sentenceToSimplify).trim()
      : '',
    sentenceToInsert: question?.sentenceToInsert
      ? String(question.sentenceToInsert).trim()
      : '',
    positions: isInsert ? ['A', 'B', 'C', 'D'] : [],
    explanation: question?.explanation ? String(question.explanation).trim() : '',
  };
}

function validatePassage(rawPassage: any, passageIndex: number) {
  if (!rawPassage || typeof rawPassage !== 'object') return null;

  const questions = Array.isArray(rawPassage.questions)
    ? rawPassage.questions
        .map((question: any, questionIndex: number) =>
          normalizeQuestion(question, passageIndex, questionIndex)
        )
        .slice(0, 10)
    : [];

  if (questions.length !== 10) return null;

  return {
    id: rawPassage.id || `p${passageIndex + 1}`,
    title: String(rawPassage.title || `Passage ${passageIndex + 1}`).trim(),
    text: String(rawPassage.text || rawPassage.passage || '').trim(),
    questions,
  };
}

function buildPassagePrompt(passageNumber: number) {
  return `
Generate passage ${passageNumber} for a TOEFL iBT Reading practice section.

Return valid JSON only. No markdown fences.

Requirements:
- One academic passage, approximately 650 to 750 words.
- The passage should look like an excerpt from a university-level textbook.
- Use paragraph numbers like [1], [2], [3], [4].
- Generate exactly 10 questions.
- Use TOEFL iBT Reading question styles.
- Most questions have 4 options A-D.
- The prose_summary question has 6 options A-F and exactly 3 correct answers.
- The insert_text question must include sentenceToInsert and answer options A-D.
- Include correctAnswer or correctAnswers for scoring.
- Include a short explanation for each answer.

Question mix:
1 factual_information
2 inference
3 rhetorical_purpose
4 negative_factual_information
5 vocabulary_in_context
6 sentence_simplification
7 insert_text
8 factual_information
9 inference
10 prose_summary

Return this exact shape:
{
  "id": "p${passageNumber}",
  "title": "string",
  "text": "string",
  "questions": [
    {
      "id": "p${passageNumber}_q1",
      "type": "factual_information",
      "paragraphNumber": 1,
      "question": "string",
      "options": [
        { "label": "A", "text": "string" },
        { "label": "B", "text": "string" },
        { "label": "C", "text": "string" },
        { "label": "D", "text": "string" }
      ],
      "answerMode": "single_choice",
      "selectCount": 1,
      "correctAnswer": "A",
      "correctAnswers": [],
      "sentenceToSimplify": "",
      "sentenceToInsert": "",
      "positions": [],
      "explanation": "string"
    }
  ]
}
`;
}

function buildFallbackPassage(passageNumber: number) {
  const topic =
    passageNumber === 1
      ? 'The Development of Urban Green Infrastructure'
      : 'The Role of Ocean Currents in Climate Regulation';

  const text =
    passageNumber === 1
      ? `[1] Urban green infrastructure refers to the planned network of parks, street trees, wetlands, green roofs, and planted corridors that cities use to manage environmental pressures. Although urban vegetation has existed for centuries, the modern concept emerged when planners began to treat natural systems as essential infrastructure rather than decorative additions. In many cities, green spaces were first justified as public health amenities, but later research showed that they also reduce heat, absorb storm water, and support biodiversity.

[2] One major function of green infrastructure is storm-water control. Traditional drainage systems move water quickly into underground pipes, which can become overwhelmed during heavy rainfall. Green infrastructure slows this process by allowing water to soak into soil or collect temporarily in planted areas. Bioswales, rain gardens, and permeable pavements are examples of features that reduce the pressure on drainage networks. This approach can be less expensive than expanding conventional sewer systems, especially in older cities where underground construction is difficult.

[3] Green infrastructure also affects urban temperatures. Dense areas made of concrete and asphalt absorb heat during the day and release it at night, creating what researchers call the urban heat-island effect. Trees and vegetation counter this effect through shade and evapotranspiration, the process by which plants release water vapor. However, the cooling benefits are not evenly distributed. Neighborhoods with fewer trees often experience higher temperatures, which can increase health risks during heat waves.

[4] Despite these advantages, green infrastructure requires careful planning. Poorly maintained green roofs may fail to retain water, and planted areas can become ineffective if soil is compacted. Cities must also consider social access. A park that improves property values may unintentionally contribute to displacement if housing costs rise nearby. For this reason, many planners argue that environmental design must be connected with housing policy, public participation, and long-term maintenance funding.`
      : `[1] Ocean currents are large-scale movements of seawater that transport heat, nutrients, and dissolved gases around the planet. Some currents are driven mainly by wind, while others are shaped by differences in temperature and salinity. Together, these systems influence regional climates by redistributing solar energy from warm equatorial zones toward cooler latitudes.

[2] Surface currents are strongly affected by prevailing winds and the rotation of Earth. For example, warm currents can carry tropical water toward higher latitudes, making nearby coastal regions milder than they would otherwise be. Cold currents can have the opposite effect, cooling adjacent land and sometimes producing dry coastal climates. These patterns help explain why places at similar latitudes may have very different weather conditions.

[3] Deep ocean circulation operates more slowly. It depends on density differences caused by temperature and salt content. Cold, salty water is dense and tends to sink, while warmer or fresher water remains closer to the surface. This sinking and rising creates a global circulation system sometimes described as a conveyor belt. Although the process is gradual, it stores and moves enormous amounts of heat.

[4] Scientists study ocean circulation because changes in current strength can affect climate systems. If a major current weakens, heat distribution may shift, altering rainfall, storm tracks, or marine ecosystems. Measuring these changes is difficult because currents vary naturally from year to year. Researchers therefore combine satellite observations, floating instruments, and computer models to distinguish long-term trends from short-term variation.`;

  const questionTypes = [
    'factual_information',
    'inference',
    'rhetorical_purpose',
    'negative_factual_information',
    'vocabulary_in_context',
    'sentence_simplification',
    'insert_text',
    'factual_information',
    'inference',
    'prose_summary',
  ];

  const questions = questionTypes.map((type, index) => {
    const id = `p${passageNumber}_q${index + 1}`;

    if (type === 'prose_summary') {
      return {
        id,
        type,
        paragraphNumber: null,
        question:
          'Complete the summary by selecting the THREE answer choices that express the most important ideas in the passage.',
        options: [
          { label: 'A', text: `The passage explains the main mechanisms and importance of ${topic.toLowerCase()}.` },
          { label: 'B', text: 'The passage focuses mainly on individual scientists who discovered the topic.' },
          { label: 'C', text: 'The passage discusses practical or environmental effects connected to the topic.' },
          { label: 'D', text: 'The passage claims that the topic is no longer relevant to modern research.' },
          { label: 'E', text: 'The passage notes that measurement, planning, or maintenance can be complex.' },
          { label: 'F', text: 'The passage argues that all earlier theories about the topic were incorrect.' },
        ],
        answerMode: 'multi_select',
        selectCount: 3,
        correctAnswer: null,
        correctAnswers: ['A', 'C', 'E'],
        sentenceToSimplify: '',
        sentenceToInsert: '',
        positions: [],
        explanation: 'A, C, and E capture the passage’s central ideas.',
      };
    }

    if (type === 'insert_text') {
      return {
        id,
        type,
        paragraphNumber: 3,
        question:
          'Look at the four possible positions marked A-D. Where would the sentence best fit?',
        options: [
          { label: 'A', text: 'A' },
          { label: 'B', text: 'B' },
          { label: 'C', text: 'C' },
          { label: 'D', text: 'D' },
        ],
        answerMode: 'single_choice',
        selectCount: 1,
        correctAnswer: 'B',
        correctAnswers: [],
        sentenceToSimplify: '',
        sentenceToInsert:
          'This process helps explain why environmental effects can extend beyond the location where they first occur.',
        positions: ['A', 'B', 'C', 'D'],
        explanation:
          'The sentence fits best where it connects a process to broader environmental effects.',
      };
    }

    return {
      id,
      type,
      paragraphNumber: Math.min(4, Math.max(1, index % 4 + 1)),
      question: `Which answer best fits the ${type.replaceAll('_', ' ')} question based on the passage?`,
      options: [
        { label: 'A', text: 'It presents a major idea that is supported by the passage.' },
        { label: 'B', text: 'It contradicts the passage.' },
        { label: 'C', text: 'It introduces information not mentioned in the passage.' },
        { label: 'D', text: 'It focuses on a minor unrelated detail.' },
      ],
      answerMode: 'single_choice',
      selectCount: 1,
      correctAnswer: 'A',
      correctAnswers: [],
      sentenceToSimplify:
        type === 'sentence_simplification'
          ? 'Although the process is gradual, it stores and moves enormous amounts of heat.'
          : '',
      sentenceToInsert: '',
      positions: [],
      explanation: 'A is supported by the passage.',
    };
  });

  return {
    id: `p${passageNumber}`,
    title: topic,
    text,
    questions,
  };
}

async function generatePassage(ai: GoogleGenAI, passageNumber: number) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: buildPassagePrompt(passageNumber),
      config: {
        responseMimeType: 'application/json',
      },
    });

    const rawText = response.text?.trim() || '{}';
    const parsed = safeParseJson(rawText);
    const validated = validatePassage(parsed, passageNumber - 1);

    if (validated) return validated;

    console.warn(`TOEFL passage ${passageNumber} invalid. Using fallback.`);
    return buildFallbackPassage(passageNumber);
  } catch (error) {
    console.warn(`TOEFL passage ${passageNumber} generation failed.`, error);
    return buildFallbackPassage(passageNumber);
  }
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
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables.');
    }

    if (!geminiApiKey) {
      throw new Error('Missing GEMINI_API_KEY secret.');
    }

    const authorization = req.headers.get('Authorization') || '';

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

    const passages = await Promise.all([
      generatePassage(ai, 1),
      generatePassage(ai, 2),
    ]);

    const task = {
      taskType: 'toefl_reading_set',
      title: 'TOEFL iBT Reading Practice',
      instructions:
        'Read the two academic passages and answer the 20 questions. Choose the best answer for each question. For summary questions, select three answers.',
      content: {
        totalTimeMin: 35,
        passages,
      },
    };

    const { data: attempt, error: attemptError } = await supabase
      .from('exam_attempts')
      .insert({
        user_id: user.id,
        language_code: 'english',
        exam_key: 'toefl_ibt',
        exam_label: 'TOEFL iBT',
        mode: 'single_section',
        status: 'in_progress',
        max_score: 30,
        metadata: {
          section: 'reading',
        },
      })
      .select('*')
      .single();

    if (attemptError) throw new Error(attemptError.message);

    const { data: section, error: sectionError } = await supabase
      .from('exam_attempt_sections')
      .insert({
        attempt_id: attempt.id,
        user_id: user.id,
        language_code: 'english',
        exam_key: 'toefl_ibt',
        section_key: 'reading',
        section_label: 'Reading',
        duration_minutes: 35,
        status: 'in_progress',
        content: task,
        max_score: 30,
      })
      .select('*')
      .single();

    if (sectionError) throw new Error(sectionError.message);

    return new Response(JSON.stringify({ attempt, section }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'Unknown TOEFL Reading generation error.',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});