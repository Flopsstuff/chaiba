const MODELS_STORAGE = 'selected_models';

export function getSelectedModel(index: number): string {
  const stored = localStorage.getItem(MODELS_STORAGE);
  if (stored) {
    const models = JSON.parse(stored);
    if (models.length > index) return models[index].id;
    if (models.length > 0) return models[0].id;
  }
  return 'openai/gpt-4o';
}
