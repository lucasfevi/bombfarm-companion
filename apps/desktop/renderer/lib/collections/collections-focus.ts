export const BOOK_BUTTON_TEST_ID = 'collections-book-button';

export function focusBookButton(code: string): void {
  document
    .querySelector<HTMLElement>(`[data-testid="${BOOK_BUTTON_TEST_ID}"][data-set="${CSS.escape(code)}"]`)
    ?.focus();
}
