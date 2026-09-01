import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LabelTheEventDemo from "./LabelTheEventDemo";

type Role = "key" | "value" | "timestamp" | "headers";

async function label(user: ReturnType<typeof userEvent.setup>, part: string, role: Role) {
  const row = screen.getByTestId(`wk-label-part-${part}`);
  await user.click(within(row).getByRole("button", { name: role }));
}

describe("LabelTheEventDemo", () => {
  it("shows the order-placed sample first", () => {
    render(<LabelTheEventDemo />);
    expect(screen.getByText(/event: order-placed/i)).toBeInTheDocument();
    expect(screen.getByTestId("wk-label-part-A")).toHaveTextContent('"order-5591"');
  });

  it("scores a fully correct labelling", async () => {
    const user = userEvent.setup();
    render(<LabelTheEventDemo />);

    await label(user, "A", "key");
    await label(user, "B", "value");
    await label(user, "C", "timestamp");
    await label(user, "D", "headers");
    await user.click(screen.getByRole("button", { name: /check answers/i }));

    expect(screen.getByTestId("wk-label-result")).toHaveTextContent("4 / 4 correct");
  });

  it("keeps check disabled until every part is labelled", async () => {
    const user = userEvent.setup();
    render(<LabelTheEventDemo />);

    await label(user, "A", "key");
    expect(screen.getByRole("button", { name: /check answers/i })).toBeDisabled();
  });

  it("marks a wrong label and explains the real role", async () => {
    const user = userEvent.setup();
    render(<LabelTheEventDemo />);

    await label(user, "A", "value"); // wrong — A is the key
    await label(user, "B", "value");
    await label(user, "C", "timestamp");
    await label(user, "D", "headers");
    await user.click(screen.getByRole("button", { name: /check answers/i }));

    expect(screen.getByTestId("wk-label-result")).toHaveTextContent("3 / 4 correct");
    expect(screen.getByTestId("wk-label-part-A")).toHaveTextContent(/by default decides the partition/i);
  });

  it("moves on to the sensor-reading sample", async () => {
    const user = userEvent.setup();
    render(<LabelTheEventDemo />);

    await label(user, "A", "key");
    await label(user, "B", "value");
    await label(user, "C", "timestamp");
    await label(user, "D", "headers");
    await user.click(screen.getByRole("button", { name: /check answers/i }));
    await user.click(screen.getByRole("button", { name: /next event/i }));

    expect(screen.getByText(/event: sensor-reading/i)).toBeInTheDocument();
    expect(screen.getByTestId("wk-label-part-A")).toHaveTextContent('"celsius"');
  });

  it("resets", async () => {
    const user = userEvent.setup();
    render(<LabelTheEventDemo />);

    await label(user, "A", "key");
    await user.click(screen.getByRole("button", { name: "reset" }));

    expect(screen.getByText(/event: order-placed/i)).toBeInTheDocument();
    expect(screen.queryByTestId("wk-label-result")).not.toBeInTheDocument();
  });
});
