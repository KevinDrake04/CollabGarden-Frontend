import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Modal } from "@heroui/react";
import { Camera, Check, Store, X, type LucideIcon } from "lucide-react";
import { AppButton } from "../../components";

export type SignupRole = "business" | "creator";

export const signupRoles: {
  id: SignupRole;
  title: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    id: "business",
    title: "Business",
    description: "Find and collaborate with local creators.",
    icon: Store,
  },
  {
    id: "creator",
    title: "Creator",
    description: "Connect with businesses and discover opportunities.",
    icon: Camera,
  },
];

export function parseSignupRole(value: string | null): SignupRole | null {
  if (value === "business" || value === "creator") return value;
  return null;
}

export function RoleOptions({
  selected,
  onSelect,
}: {
  selected: SignupRole | null;
  onSelect: (role: SignupRole) => void;
}) {
  return (
    <div
      className="flex flex-col gap-3"
      role="radiogroup"
      aria-label="How would you like to join CollabGarden?"
    >
      {signupRoles.map((option) => {
        const Icon = option.icon;
        const isSelected = selected === option.id;

        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onSelect(option.id)}
            className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 text-left ${
              isSelected
                ? "border-[var(--cg-primary)] bg-[var(--cg-background)]"
                : "border-[var(--cg-border)] bg-white hover:bg-[var(--cg-background)]"
            }`}
          >
            <span
              className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                isSelected
                  ? "bg-[var(--cg-primary)] text-white"
                  : "bg-[var(--cg-background)] text-[var(--cg-primary)]"
              }`}
            >
              <Icon size={18} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-[var(--cg-primary-dark)]">
                {option.title}
              </span>
              <span className="mt-1 block text-sm text-[var(--cg-muted)]">
                {option.description}
              </span>
            </span>
            {isSelected && (
              <Check
                size={18}
                className="ml-auto shrink-0 text-[var(--cg-primary)]"
                aria-hidden="true"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

export function RoleSelectModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [role, setRole] = useState<SignupRole | null>(null);

  useEffect(() => {
    if (!open) setRole(null);
  }, [open]);

  function onContinue() {
    if (!role) return;
    onClose();
    navigate(`/signup?role=${role}`);
  }

  return (
    <Modal>
      <Modal.Backdrop
        isOpen={open}
        onOpenChange={(isOpen) => {
          if (!isOpen) onClose();
        }}
      >
        <Modal.Container size="md" placement="center">
          <Modal.Dialog aria-label="How would you like to join CollabGarden?">
            <Modal.Header>
              <Modal.Heading className="text-lg font-bold text-balance text-[var(--cg-primary-dark)]">
                How would you like to join CollabGarden?
              </Modal.Heading>
              <Modal.CloseTrigger>
                <X size={18} aria-hidden="true" />
              </Modal.CloseTrigger>
            </Modal.Header>
            <Modal.Body>
              <RoleOptions selected={role} onSelect={setRole} />
            </Modal.Body>
            <Modal.Footer>
              <AppButton
                className="w-full"
                isDisabled={!role}
                onPress={onContinue}
              >
                Continue
              </AppButton>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
