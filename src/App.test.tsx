import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import App from "@/App";

const getCount = () => screen.getByRole("status", { name: "Current count" });

const click = (user: ReturnType<typeof userEvent.setup>, name: string) =>
  user.click(screen.getByRole("button", { name }));

describe("App", () => {
  it("should render the counter starting at 0", () => {
    render(<App />);

    expect(getCount()).toHaveTextContent(/^0$/);
  });

  it("should increment and decrement the count", async () => {
    const user = userEvent.setup();
    render(<App />);

    await click(user, "Increment count");
    expect(getCount()).toHaveTextContent(/^1$/);

    await click(user, "Decrement count");
    expect(getCount()).toHaveTextContent(/^0$/);
  });

  it("should colour the count blue while it is not negative", () => {
    render(<App />);

    expect(getCount()).toHaveClass("text-blue-600");
    expect(getCount()).not.toHaveClass("text-red-600");
  });

  it("should replace the base colour with red once the count goes negative", async () => {
    const user = userEvent.setup();
    render(<App />);

    await click(user, "Decrement count");

    expect(getCount()).toHaveTextContent(/^-1$/);
    expect(getCount()).toHaveClass("text-red-600");
    expect(getCount()).not.toHaveClass("text-blue-600");
  });
});
