export const ResetButton = ({
  label,
  atDefault,
  onReset,
}: {
  label: string;
  atDefault: boolean;
  onReset: () => void;
}) => (
  <button
    type="button"
    aria-label={`Reset ${label}`}
    title={`Reset ${label}`}
    disabled={atDefault}
    className="inline-flex size-5 items-center justify-center rounded text-gray-600 hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent"
    onClick={onReset}
  >
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 8a5.5 5.5 0 1 0 1.8-4.1" />
      <path d="M2.5 2.5v3h3" />
    </svg>
  </button>
);
