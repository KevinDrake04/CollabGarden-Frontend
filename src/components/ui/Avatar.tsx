import { Avatar } from "@heroui/react";

interface AppAvatarProps {
  name: string;
  imageUrl?: string;
  size?: "sm" | "md" | "lg";
}

export function AppAvatar({ name, imageUrl, size = "md" }: AppAvatarProps) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .filter((part) => /[A-Za-z]/.test(part))
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?";

  return (
    <Avatar size={size} variant="soft" color="accent">
      {imageUrl && <Avatar.Image src={imageUrl} alt={name} />}
      <Avatar.Fallback>{initials}</Avatar.Fallback>
    </Avatar>
  );
}
