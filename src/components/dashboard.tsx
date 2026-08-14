"use client";

import { useRef, useState } from "react";
import { Compass, PlusCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateListingForm } from "@/components/create-listing-form";
import { ExploreMatches, type ExploreHandle } from "@/components/explore-matches";
import type { PublicListing } from "@/lib/types";

export function Dashboard({ initialListings }: { initialListings: PublicListing[] }) {
  const [tab, setTab] = useState("crear");

  // Al publicar algo nuevo se le pide al explorador que recargue. Se hace por
  // referencia imperativa en vez de con un contador y un efecto: así la recarga
  // nace de un evento real y no de un render en cascada.
  const exploreRef = useRef<ExploreHandle>(null);

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="crear">
          <PlusCircle aria-hidden /> Crear publicación
        </TabsTrigger>
        <TabsTrigger value="explorar">
          <Compass aria-hidden /> Explorar / Matchmaking
        </TabsTrigger>
      </TabsList>

      <TabsContent value="crear">
        <CreateListingForm onCreated={() => exploreRef.current?.refresh()} />
      </TabsContent>

      {/* forceMount mantiene el explorador montado aunque la pestaña esté
          oculta, para que la referencia exista cuando el formulario publique. */}
      <TabsContent value="explorar" forceMount hidden={tab !== "explorar"}>
        <ExploreMatches ref={exploreRef} initialListings={initialListings} />
      </TabsContent>
    </Tabs>
  );
}
