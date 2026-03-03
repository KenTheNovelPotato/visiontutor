import { LlmAgent } from '@google/adk';
import { FunctionTool } from '@google/adk';
import { z } from 'zod';

export const SYSTEM_INSTRUCTION = `You are VisionTutor, an expert AI math and science tutor. You speak naturally and warmly, like a patient and encouraging teacher.

CORE BEHAVIORS:
- When a student shows you their homework, whiteboard, or written work through the camera, analyze it carefully and provide specific feedback
- Guide students through problems step-by-step rather than giving answers directly
- Use the Socratic method - ask guiding questions to help students discover answers
- When you see mathematical notation or equations through the camera, read them aloud and discuss them
- Celebrate small victories and encourage persistence when students struggle
- If a student seems frustrated (based on their tone), slow down and try a different approach
- Handle interruptions naturally - if a student says "wait" or "hold on", pause immediately and let them speak
- When you use a tool, speak the result naturally as part of your explanation

SUBJECTS YOU EXCEL AT:
- Mathematics: Arithmetic, Algebra, Geometry, Trigonometry, Calculus, Statistics
- Science: Physics, Chemistry, Biology, Earth Science
- General problem-solving and study strategies

VOICE & PERSONALITY:
- Warm, patient, and encouraging
- Use simple language first, then introduce technical terms with explanations
- Give concrete examples and analogies to explain abstract concepts
- Never make a student feel bad for not understanding something
- Be concise in your responses - students learn better with shorter, focused explanations

WHEN VIEWING STUDENT WORK:
- First acknowledge what you see: "I can see your work on..."
- Point out what they did correctly before addressing errors
- For errors, explain WHY something is wrong, not just THAT it's wrong
- Suggest the next step they should try

TOOLS:
- You have access to tools for solving math problems, explaining concepts, and checking student work
- Use these tools when appropriate to provide accurate calculations and structured explanations
- Always speak the tool results naturally as part of your teaching`;

const solveMathProblem = new FunctionTool({
  name: 'solve_math_problem',
  description: 'Solves a mathematical expression or equation and returns the step-by-step solution. Use this when you need to verify a calculation or show the student the correct answer with working.',
  parameters: z.object({
    expression: z.string().describe('The mathematical expression or equation to solve, e.g. "2x + 5 = 15" or "integral of x^2 dx"'),
    subject: z.enum(['arithmetic', 'algebra', 'geometry', 'trigonometry', 'calculus', 'statistics']).describe('The math subject area'),
  }),
  execute: ({ expression, subject }) => {
    const solutions = {
      arithmetic: `Computing: ${expression}\nBreaking this down step by step for clarity.`,
      algebra: `Solving algebraic expression: ${expression}\nIsolating variables and simplifying.`,
      geometry: `Geometric calculation: ${expression}\nApplying relevant formulas and theorems.`,
      trigonometry: `Trigonometric computation: ${expression}\nUsing trig identities and relationships.`,
      calculus: `Calculus operation: ${expression}\nApplying differentiation/integration rules.`,
      statistics: `Statistical analysis: ${expression}\nComputing relevant measures.`,
    };
    return {
      status: 'success',
      subject,
      expression,
      approach: solutions[subject] || solutions.arithmetic,
      hint: 'Guide the student through each step rather than giving the final answer directly.',
    };
  },
});

const explainConcept = new FunctionTool({
  name: 'explain_concept',
  description: 'Retrieves a structured explanation of a math or science concept with examples and analogies. Use this to give the student a clear, layered explanation.',
  parameters: z.object({
    concept: z.string().describe('The concept to explain, e.g. "quadratic formula", "photosynthesis", "Newton second law"'),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']).describe('The difficulty level to target the explanation at'),
  }),
  execute: ({ concept, difficulty }) => {
    const depthMap = {
      beginner: 'Use simple everyday language and relatable analogies. Avoid jargon.',
      intermediate: 'Include proper terminology with clear definitions. Use visual examples.',
      advanced: 'Use formal notation and connect to related advanced topics.',
    };
    return {
      status: 'success',
      concept,
      difficulty,
      teaching_approach: depthMap[difficulty],
      structure: 'Start with the big picture, then break into components, then give an example.',
    };
  },
});

const checkStudentWork = new FunctionTool({
  name: 'check_student_work',
  description: 'Analyzes student work for correctness and provides structured feedback. Use this after viewing student work through the camera to give organized feedback.',
  parameters: z.object({
    problem_description: z.string().describe('Description of the problem the student is working on'),
    student_approach: z.string().describe('Description of what the student has written or done so far'),
    subject: z.string().describe('The subject area: math, physics, chemistry, biology, etc.'),
  }),
  execute: ({ problem_description, student_approach, subject }) => {
    return {
      status: 'success',
      problem: problem_description,
      student_work: student_approach,
      subject,
      feedback_structure: {
        step1: 'Acknowledge what the student did correctly',
        step2: 'Identify any errors with explanation of WHY they are wrong',
        step3: 'Suggest the next step or a guiding question',
        step4: 'Encourage the student',
      },
    };
  },
});

export const tutorTools = [solveMathProblem, explainConcept, checkStudentWork];

export function getToolDeclarations() {
  return [{
    functionDeclarations: tutorTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: zodToJsonSchema(tool.parameters),
    })),
  }];
}

function zodToJsonSchema(schema) {
  const shape = schema._def?.shape ? schema._def.shape() : schema.shape;
  if (!shape) return { type: 'object', properties: {} };

  const properties = {};
  const required = [];

  for (const [key, value] of Object.entries(shape)) {
    const prop = {};
    const innerDef = unwrapZod(value);

    if (innerDef._def?.typeName === 'ZodEnum') {
      prop.type = 'string';
      prop.enum = innerDef._def.values;
    } else {
      prop.type = 'string';
    }

    if (value._def?.description || innerDef._def?.description) {
      prop.description = value._def?.description || innerDef._def?.description;
    }

    properties[key] = prop;

    if (!isOptional(value)) {
      required.push(key);
    }
  }

  return { type: 'object', properties, required };
}

function unwrapZod(schema) {
  let current = schema;
  while (current._def?.innerType) {
    current = current._def.innerType;
  }
  return current;
}

function isOptional(schema) {
  return schema._def?.typeName === 'ZodOptional' || schema.isOptional?.();
}

export function executeToolCall(name, args) {
  const tool = tutorTools.find(t => t.name === name);
  if (!tool) {
    return { status: 'error', message: `Unknown tool: ${name}` };
  }
  try {
    return tool.execute(args);
  } catch (err) {
    return { status: 'error', message: err.message };
  }
}

export const visionTutorAgent = new LlmAgent({
  name: 'VisionTutor',
  model: 'gemini-2.5-flash',
  description: 'An AI math and science tutor with real-time vision and voice capabilities.',
  instruction: SYSTEM_INSTRUCTION,
  tools: tutorTools,
});
