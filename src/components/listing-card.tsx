"use client";

import { MapPin, Package, Recycle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PropertiesList } from "@/components/properties-list";
import { cn, formatTons } from "@/lib/utils";
import type { PublicListing } from "@/lib/types";

interface ListingCardProps {
  listing: PublicListing;
  selected?: boolean;
  onSelect?: (listing: PublicListing) => void;
  /** Texto de acción que aparece al pasar por encima. */
  actionHint?: string;
}

export function ListingCard({
  listing,
  selected = false,
  onSelect,
  actionHint,
}: ListingCardProps) {
  const isOffer = listing.type === "OFERTA";
  const interactive = typeof onSelect === "function";

  return (
    <Card
      onClick={interactive ? () => onSelect?.(listing) : undefined}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect?.(listing);
              }
            }
          : undefined
      }
      className={cn(
        "group p-4 transition-all",
        interactive && "cursor-pointer hover:border-[var(--ring)] hover:shadow-md",
        selected && "border-[var(--ring)] ring-2 ring-[var(--ring)]/30",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <Badge variant={isOffer ? "offer" : "demand"}>
          {isOffer ? "OFERTA" : "DEMANDA"}
        </Badge>
        {listing.ler_code ? (
          <Badge variant="mono" title={listing.ler_description ?? undefined}>
            LER {listing.ler_code}
          </Badge>
        ) : null}
      </div>

      <h3 className="mt-2.5 text-sm font-semibold leading-snug">{listing.title}</h3>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted-foreground)]">
        <span className="inline-flex items-center gap-1">
          <Package className="size-3.5" aria-hidden />
          <span className="tabular">{formatTons(listing.quantity_ton_month)}</span>
        </span>
        {listing.anonymous_location ? (
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" aria-hidden />
            {listing.anonymous_location}
          </span>
        ) : null}
      </div>

      {listing.ler_description ? (
        <p className="mt-2 inline-flex items-start gap-1 text-xs text-[var(--muted-foreground)]">
          <Recycle className="mt-px size-3.5 shrink-0" aria-hidden />
          {listing.ler_description}
        </p>
      ) : null}

      <div className="mt-3">
        <PropertiesList properties={listing.properties} />
      </div>

      {actionHint ? (
        <p className="mt-3 text-xs font-medium text-[var(--primary)] opacity-0 transition-opacity group-hover:opacity-100">
          {actionHint}
        </p>
      ) : null}
    </Card>
  );
}
