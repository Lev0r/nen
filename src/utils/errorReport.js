const USER_MESSAGE = 'An error occurred. Check the console for details.';

export function reportError(context, error, setUiError) {
  console.error(`[${context}]`, {
    context,
    message: error?.message,
    code: error?.code,
    details: error?.details,
    stack: error?.stack,
  }, error);

  if (typeof setUiError === 'function') {
    setUiError(USER_MESSAGE);
  }

  return USER_MESSAGE;
}
