// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Button } from "./button";
import { Modal, ModalClose } from "./modal";

function AddProductModal() {
  return (
    <>
      <Button>Behind the modal</Button>
      <Modal
        trigger={<Button>Add product</Button>}
        title="Add product"
        description="Fill in the details."
        footer={
          <>
            <ModalClose asChild>
              <Button variant="secondary">Cancel</Button>
            </ModalClose>
            <Button type="submit">Save product</Button>
          </>
        }
      >
        <label>
          Title
          <input name="title" />
        </label>
      </Modal>
    </>
  );
}

describe("Modal", () => {
  it("opens from its trigger as a labelled dialog with focus inside", async () => {
    const user = userEvent.setup();
    render(<AddProductModal />);

    await user.click(screen.getByRole("button", { name: "Add product" }));

    const dialog = screen.getByRole("dialog", { name: "Add product" });
    expect(dialog).toHaveAccessibleDescription("Fill in the details.");
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it("keeps keyboard focus inside while open", async () => {
    const user = userEvent.setup();
    render(<AddProductModal />);
    await user.click(screen.getByRole("button", { name: "Add product" }));
    const dialog = screen.getByRole("dialog");

    for (let i = 0; i < 8; i++) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
    for (let i = 0; i < 8; i++) {
      await user.tab({ shift: true });
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<AddProductModal />);
    const trigger = screen.getByRole("button", { name: "Add product" });
    await user.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("closes from a ModalClose button and from the close icon", async () => {
    const user = userEvent.setup();
    render(<AddProductModal />);

    await user.click(screen.getByRole("button", { name: "Add product" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add product" }));
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
