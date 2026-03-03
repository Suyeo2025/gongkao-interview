"use client";

import { useState, useMemo } from "react";
import { QAPair, QuestionCategory, ALL_CATEGORIES, CATEGORY_COLORS } from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Star, FolderOpen, X, ChevronDown, ChevronRight } from "lucide-react";

interface SidebarProps {
  history: QAPair[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  stats: {
    total: number;
    favorites: number;
    byCategory: Record<string, number>;
  };
}

export function Sidebar({
  history,
  selectedId,
  onSelect,
  onToggleFavorite,
  stats,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<QuestionCategory | "all" | "favorites">("all");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(ALL_CATEGORIES));

  const filtered = useMemo(() => {
    let items = history;

    if (filterCategory === "favorites") {
      items = items.filter((p) => p.question.isFavorite);
    } else if (filterCategory !== "all") {
      items = items.filter(
        (p) =>
          p.answer.metadata?.category === filterCategory ||
          p.question.category === filterCategory
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (p) =>
          p.question.content.toLowerCase().includes(q) ||
          p.question.id.toLowerCase().includes(q)
      );
    }

    return items;
  }, [history, filterCategory, searchQuery]);

  const groupedByCategory = useMemo(() => {
    const groups: Record<string, QAPair[]> = {};
    for (const cat of ALL_CATEGORIES) {
      groups[cat] = [];
    }
    for (const pair of filtered) {
      const cat = pair.answer.metadata?.category || pair.question.category || "综合分析";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(pair);
    }
    return groups;
  }, [filtered]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  return (
    <div className="h-full flex flex-col bg-zinc-50 border-r border-zinc-200">
      {/* Header */}
      <div className="p-4 border-b border-zinc-200">
        <h2 className="font-semibold text-sm text-zinc-700 mb-3">
          历史记录
          <span className="text-zinc-400 font-normal ml-1.5">({stats.total})</span>
        </h2>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索题目..."
            className="pl-8 h-8 text-xs bg-white"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
              onClick={() => setSearchQuery("")}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="px-4 py-2 flex gap-1.5 flex-wrap border-b border-zinc-200">
        <Button
          variant={filterCategory === "all" ? "default" : "ghost"}
          size="sm"
          className="h-6 text-xs px-2"
          onClick={() => setFilterCategory("all")}
        >
          全部
        </Button>
        <Button
          variant={filterCategory === "favorites" ? "default" : "ghost"}
          size="sm"
          className="h-6 text-xs px-2"
          onClick={() => setFilterCategory("favorites")}
        >
          <Star className="h-3 w-3 mr-1" />
          收藏 ({stats.favorites})
        </Button>
      </div>

      {/* Category list */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {filterCategory === "all" || filterCategory === "favorites" ? (
            ALL_CATEGORIES.map((cat) => {
              const items = groupedByCategory[cat] || [];
              if (items.length === 0) return null;
              const isExpanded = expandedCategories.has(cat);
              const colors = CATEGORY_COLORS[cat];

              return (
                <div key={cat} className="mb-1">
                  <button
                    onClick={() => toggleCategory(cat)}
                    className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-zinc-100/60 transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
                    )}
                    <FolderOpen className="h-3.5 w-3.5 text-zinc-500" />
                    <span className="text-xs font-medium text-zinc-700">{cat}</span>
                    <Badge variant="outline" className={`text-[10px] ml-auto px-1.5 py-0 ${colors}`}>
                      {items.length}
                    </Badge>
                  </button>

                  {isExpanded && (
                    <div className="ml-5 space-y-0.5 mt-0.5">
                      {items.map((pair) => (
                        <button
                          key={pair.question.id}
                          onClick={() => onSelect(pair.question.id)}
                          className={`flex items-start gap-2 w-full text-left px-2 py-2 rounded text-xs transition-colors ${
                            selectedId === pair.question.id
                              ? "bg-violet-50 text-violet-700 border border-violet-200/60"
                              : "hover:bg-zinc-100/60 text-zinc-600"
                          }`}
                        >
                          {pair.question.isFavorite && (
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0 mt-0.5" />
                          )}
                          <span className="line-clamp-2 leading-relaxed">
                            <span className="text-zinc-400 font-mono mr-1">{pair.question.id}</span>
                            {pair.question.content.slice(0, 50)}
                            {pair.question.content.length > 50 ? "..." : ""}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="space-y-0.5">
              {filtered.map((pair) => (
                <button
                  key={pair.question.id}
                  onClick={() => onSelect(pair.question.id)}
                  className={`flex items-start gap-2 w-full text-left px-2 py-2 rounded text-xs transition-colors ${
                    selectedId === pair.question.id
                      ? "bg-violet-50 text-violet-700 border border-violet-200/60"
                      : "hover:bg-zinc-100/60 text-zinc-600"
                  }`}
                >
                  {pair.question.isFavorite && (
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0 mt-0.5" />
                  )}
                  <span className="line-clamp-2 leading-relaxed">
                    <span className="text-zinc-400 font-mono mr-1">{pair.question.id}</span>
                    {pair.question.content.slice(0, 50)}
                    {pair.question.content.length > 50 ? "..." : ""}
                  </span>
                </button>
              ))}
            </div>
          )}

          {filtered.length === 0 && (
            <div className="text-center py-8 text-xs text-zinc-400">
              暂无记录
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
