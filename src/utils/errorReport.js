const USER_MESSAGE = 'An error occurred. Check the console for details.';

export function formatCallableError(error) {
  if (error?.code === 'functions/deadline-exceeded') {
    return 'Request timed out. The job may still be running on the server — reopen Maintenance in a few minutes and check last load time.';
  }
  return USER_MESSAGE;
}

export function reportError(context, error, setUiError) {
  console.error(`[${context}]`, {
    context,
    message: error?.message,
    code: error?.code,
    details: error?.details,
    stack: error?.stack,
  }, error);

  const message = formatCallableError(error);

  if (typeof setUiError === 'function') {
    setUiError(message);
  }

  return message;
}
