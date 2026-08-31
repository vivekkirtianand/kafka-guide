import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TroubleshootingCatalog from "./TroubleshootingCatalog";

describe("TroubleshootingCatalog", () => {
  it("opens the first entry by default and keeps the rest collapsed", () => {
    render(<TroubleshootingCatalog />);
    const first = screen.getByTestId("entry-consumer-lag");
    expect(within(first).getByText(/Lag is log-end-offset/)).toBeInTheDocument();
    const second = screen.getByTestId("entry-frequent-rebalances");
    expect(within(second).queryByText(/A rebalance reassigns partitions/)).not.toBeInTheDocument();
  });

  it("toggles an entry open and closed", async () => {
    const user = userEvent.setup();
    render(<TroubleshootingCatalog />);
    const row = screen.getByTestId("entry-timeout-errors");

    await user.click(within(row).getByRole("button", { name: /Timeout errors/ }));
    expect(within(row).getByText(/several different clocks/)).toBeInTheDocument();

    await user.click(within(row).getByRole("button", { name: /Timeout errors/ }));
    expect(within(row).queryByText(/several different clocks/)).not.toBeInTheDocument();
  });

  it("renders per-cause evidence and key-config chips for an open entry", () => {
    render(<TroubleshootingCatalog />);
    const first = screen.getByTestId("entry-consumer-lag");
    expect(within(first).getByText(/records-consumed-rate is well below the produce rate/)).toBeInTheDocument();
    expect(within(first).getByText("max.poll.records")).toBeInTheDocument();
  });

  it("filters by symptom, cause, evidence, or config key", async () => {
    const user = userEvent.setup();
    render(<TroubleshootingCatalog />);
    const box = screen.getByPlaceholderText(/Search a symptom/);

    await user.type(box, "advertised.listeners");
    expect(screen.getByTestId("entry-connectivity-and-auth")).toBeInTheDocument();
    expect(screen.queryByTestId("entry-consumer-lag")).not.toBeInTheDocument();

    await user.clear(box);
    await user.type(box, "unclean leader election");
    expect(screen.getByTestId("entry-data-integrity-issues")).toBeInTheDocument();
  });

  it("shows a no-match state", async () => {
    const user = userEvent.setup();
    render(<TroubleshootingCatalog />);
    await user.type(screen.getByPlaceholderText(/Search a symptom/), "zzzznotathing");
    expect(screen.getByText("No matching symptoms.")).toBeInTheDocument();
  });
});
