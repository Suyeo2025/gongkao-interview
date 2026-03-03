"use client";

import { useState, useCallback } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CopyButtonProps {
  text: string;
  label?: string;
  size?: "sm" | "default" | "icon";
  variant?: "ghost" | "outline" | "default";
}

export function CopyButton({
  text,
  label,
  size = "sm",
  variant = "outline",
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [text]);

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleCopy}
      className="gap-1.5 text-xs rounded-lg hover:text-violet-600 hover:border-violet-200"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-600" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      {label && <span>{copied ? "已复制" : label}</span>}
    </Button>
  );
}
