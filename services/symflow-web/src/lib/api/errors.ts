import { ApiError } from '$lib/api/http';

export type ViewError = {
  title: string;
  message: string;
  status?: number;
};

export function toViewError(error: unknown, title = 'Unable to load data'): ViewError {
  if (error instanceof ApiError) {
    return {
      title,
      message: error.message,
      status: error.status
    };
  }

  if (error instanceof Error) {
    return {
      title,
      message: error.message
    };
  }

  return {
    title,
    message: 'Unexpected error while contacting the Symflow API.'
  };
}
