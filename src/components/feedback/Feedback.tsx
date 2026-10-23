import { type ReactNode } from "react";
import { Alert, Card, CloseButton, Modal, Skeleton } from "@heroui/react";
import {
  AlertCircle,
  CheckCircle,
  Info,
  MapPin,
  MessageCircle,
  Star,
  X,
} from "lucide-react";
import { AppAvatar, AppButton } from "../ui/Primitives";

const cardClass = "rounded-2xl border border-[var(--cg-border)] bg-white p-5";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <Card
      className={`${cardClass} flex flex-col items-center gap-3 py-8 text-center`}
    >
      <MessageCircle
        size={28}
        className="text-[var(--cg-primary)]"
        aria-hidden="true"
      />
      <strong>{title}</strong>
      <p className="text-sm text-[var(--cg-muted)]">{description}</p>
      {action}
    </Card>
  );
}

interface AppNoticeProps {
  tone?: "success" | "error" | "info";
  message: string;
  onClose?: () => void;
}

export function AppNotice({
  tone = "success",
  message,
  onClose,
}: AppNoticeProps) {
  const Icon =
    tone === "error" ? AlertCircle : tone === "info" ? Info : CheckCircle;
  const status =
    tone === "error" ? "danger" : tone === "info" ? "accent" : "success";

  return (
    <Alert status={status}>
      <Alert.Indicator>
        <Icon size={18} aria-hidden="true" />
      </Alert.Indicator>
      <Alert.Content>
        <Alert.Description>{message}</Alert.Description>
      </Alert.Content>
      {onClose && (
        <CloseButton aria-label="Dismiss notification" onPress={onClose}>
          <X size={16} aria-hidden="true" />
        </CloseButton>
      )}
    </Alert>
  );
}

export function LoadingSkeleton({ lines = 3 }: { lines?: number }) {
  const count = Math.max(1, lines);

  return (
    <Card
      className={`${cardClass} flex flex-col gap-3`}
      aria-label="Loading content"
      aria-busy="true"
    >
      {Array.from({ length: count }, (_, index) => (
        <Skeleton
          key={index}
          className="h-4 rounded-md"
          style={{
            width: `${index === 0 ? 55 : index === count - 1 ? 75 : 100}%`,
          }}
        />
      ))}
    </Card>
  );
}

interface ReviewCardProps {
  author: string;
  rating: number;
  review: string;
  date?: string;
}

export function ReviewCard({ author, rating, review, date }: ReviewCardProps) {
  return (
    <Card role="article" className={`${cardClass} flex flex-col gap-3`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2">
          <AppAvatar name={author} size="sm" />
          <strong>{author}</strong>
        </span>
        {date && <span className="text-xs text-[var(--cg-muted)]">{date}</span>}
      </div>
      <div className="inline-flex items-center gap-1 text-sm text-[var(--cg-primary-dark)]">
        <Star size={16} fill="currentColor" aria-hidden="true" />
        {rating.toFixed(1)} / 5
      </div>
      <p>{review}</p>
    </Card>
  );
}

interface MessageBubbleProps {
  text: string;
  time?: string;
  outgoing?: boolean;
}

export function MessageBubble({
  text,
  time,
  outgoing = false,
}: MessageBubbleProps) {
  return (
    <div
      className={`flex max-w-80 flex-col gap-1 rounded-xl px-4 py-3 text-sm ${
        outgoing
          ? "ml-auto bg-[var(--cg-primary)] text-white"
          : "mr-auto bg-[var(--cg-background)] text-[var(--cg-text)]"
      }`}
    >
      <span>{text}</span>
      {time && <small className="text-xs opacity-75">{time}</small>}
    </div>
  );
}

// Visual price marker only. Map integration comes later.
export function MapPriceMarker({
  price,
  active = false,
}: {
  price: string;
  active?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-2 text-sm font-semibold shadow-sm ${
        active
          ? "border-[var(--cg-primary)] bg-[var(--cg-primary)] text-white"
          : "border-[var(--cg-border)] bg-white text-[var(--cg-text)]"
      }`}
    >
      <MapPin size={14} aria-hidden="true" />
      {price}
    </span>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Modal>
      <Modal.Backdrop
        isOpen={open}
        onOpenChange={(isOpen) => {
          if (!isOpen) onClose();
        }}
      >
        <Modal.Container size="sm" placement="center">
          <Modal.Dialog aria-label={title}>
            <Modal.Header>
              <Modal.Heading>{title}</Modal.Heading>
              <Modal.CloseTrigger>
                <X size={18} aria-hidden="true" />
              </Modal.CloseTrigger>
            </Modal.Header>
            <Modal.Body>
              <p>{description}</p>
            </Modal.Body>
            <Modal.Footer>
              <AppButton variant="secondary" onPress={onClose}>
                Cancel
              </AppButton>
              <AppButton onPress={onConfirm}>{confirmLabel}</AppButton>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
