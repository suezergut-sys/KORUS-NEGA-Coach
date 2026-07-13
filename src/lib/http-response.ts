export type JsonResponseResult<T> = {
  payload: T | null;
  isJson: boolean;
};

export async function readJsonResponse<T>(response: Response): Promise<JsonResponseResult<T>> {
  const text = await response.text();
  if (!text.trim()) return { payload: null, isJson: false };

  try {
    return { payload: JSON.parse(text) as T, isJson: true };
  } catch {
    return { payload: null, isJson: false };
  }
}
