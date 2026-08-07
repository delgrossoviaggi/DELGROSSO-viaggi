export function extractData(result, fallback) {
  if (result && typeof result === 'object' && 'success' in result && 'data' in result) {
    if (result.success === false) {
      const error = result.error instanceof Error
        ? result.error
        : new Error(
          typeof result.error === 'object' ? result.error?.message : result.error || 'Operazione non riuscita'
        );
      if (result.error && typeof result.error === 'object') {
        Object.assign(error, result.error);
      }
      throw error;
    }
    if (Array.isArray(fallback)) {
      return Array.isArray(result.data) ? result.data : fallback;
    }
    return result.data ?? fallback;
  }
  return result ?? fallback;
}
