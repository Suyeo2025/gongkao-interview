"use client";

import { Badge } from "@/components/ui/badge";
import { QuestionCategory, CATEGORY_COLORS } from "@/lib/types";

interface CategoryBadgeProps {
  category: QuestionCategory;
  size?: "sm" | "default";
}

export function CategoryBadge({ category, size = "default" }: CategoryBadgeProps) {
  const colors = CATEGORY_COLORS[category] || "bg-gray-100 text-gray-700 border-gray-200";

  return (
    <Badge
      variant="outline"
      className={`${colors} ${size === "sm" ? "text-[10px] px-1.5 py-0" : "text-xs px-2 py-0.5"} font-medium border`}
    >
      {category}
    </Badge>
  );
}
