export const RUSSIAN_LANGUAGE_CONTRACT = `
# ОБЯЗАТЕЛЬНЫЙ ЯЗЫК ТРЕНАЖЁРА
- Это полностью русскоязычный тренажёр переговоров. Произноси абсолютно каждую реплику только на русском языке.
- Первая реплика оппонента обязательно должна быть на русском языке.
- Никогда не начинай с английского приветствия и не переходи на английский или другой язык, даже если пользователь говорит на нём.
- Допустимы только общеупотребительные названия, имена и термины, которые нельзя естественно заменить русскими; вся остальная фраза должна оставаться русской.
`.trim();

export const FIRST_OPPONENT_TURN_INSTRUCTIONS = `
Начни переговоры первым и сразу говори от лица персонажа. В первой реплике кратко обозначь стартовую позицию по кейсу и задай один конкретный вопрос участнику. Не используй нейтральное знакомство, не спрашивай, о чём пользователь хочет поговорить, и не предлагай выбрать тему разговора.
`.trim();

export function withRussianLanguageContract(instructions?: string) {
  const responseInstructions = instructions?.trim();
  if (responseInstructions?.includes(RUSSIAN_LANGUAGE_CONTRACT)) return responseInstructions;
  return responseInstructions
    ? `${RUSSIAN_LANGUAGE_CONTRACT}\n\n${responseInstructions}`
    : RUSSIAN_LANGUAGE_CONTRACT;
}
