"use client";

import { useRef, useState } from "react";
import { Compass, Inbox, PlusCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateListingForm } from "@/components/create-listing-form";
import { ExploreMatches, type ExploreHandle } from "@/components/explore-matches";
import { AuthPanel } from "@/components/auth-panel";
import {
  ContactRequestsPanel,
  type ContactRequestsHandle,
} from "@/components/contact-requests-panel";
import type { ContactRequestView, PublicListing, SessionCompany } from "@/lib/types";

export function Dashboard({
  initialListings,
  company,
  ownListingIds,
  initialRequests,
}: {
  initialListings: PublicListing[];
  company: SessionCompany | null;
  /** Ids de las publicaciones de la empresa de la sesión (vacío sin sesión). */
  ownListingIds: string[];
  /** Bandeja de solicitudes de la sesión (vacía sin sesión). */
  initialRequests: ContactRequestView[];
}) {
  const [tab, setTab] = useState("crear");
  // Las que se publiquen en esta visita se suman aquí, sin recargar la página.
  const [ownIds, setOwnIds] = useState(ownListingIds);

  // Al publicar algo nuevo se le pide al explorador que recargue. Se hace por
  // referencia imperativa en vez de con un contador y un efecto: así la recarga
  // nace de un evento real y no de un render en cascada.
  const exploreRef = useRef<ExploreHandle>(null);
  const requestsRef = useRef<ContactRequestsHandle>(null);

  function changeTab(value: string) {
    setTab(value);
    // Las solicitudes cambian por acciones de otras empresas: al abrir la
    // pestaña se pide la bandeja al día.
    if (value === "solicitudes") requestsRef.current?.refresh();
  }

  return (
    <Tabs value={tab} onValueChange={changeTab}>
      <TabsList>
        <TabsTrigger value="crear">
          <PlusCircle aria-hidden /> Crear publicación
        </TabsTrigger>
        <TabsTrigger value="explorar">
          <Compass aria-hidden /> Explorar / Matchmaking
        </TabsTrigger>
        <TabsTrigger value="solicitudes">
          <Inbox aria-hidden /> Solicitudes
        </TabsTrigger>
      </TabsList>

      {/* Publicar exige sesión: es lo que ata cada publicación a una empresa y
          permite comprobar después quién puede pedir un descruce en su nombre. */}
      <TabsContent value="crear">
        {company ? (
          <CreateListingForm
            company={company}
            onCreated={(listing) => {
              setOwnIds((ids) => [...ids, listing.id]);
              exploreRef.current?.refresh();
            }}
          />
        ) : (
          <AuthPanel />
        )}
      </TabsContent>

      {/* Explorar sigue siendo público a propósito: el catálogo ya es anónimo, y
          obligar a registrarse para mirar mataría la primera impresión. */}
      <TabsContent value="explorar" forceMount hidden={tab !== "explorar"}>
        <ExploreMatches
          ref={exploreRef}
          initialListings={initialListings}
          authenticated={company !== null}
          ownListingIds={ownIds}
        />
      </TabsContent>

      {/* Montado siempre (como el explorador) para que la referencia exista al
          cambiar de pestaña y la bandeja se recargue desde ese evento. */}
      <TabsContent value="solicitudes" forceMount hidden={tab !== "solicitudes"}>
        {company ? (
          <ContactRequestsPanel ref={requestsRef} initialRequests={initialRequests} />
        ) : (
          <AuthPanel />
        )}
      </TabsContent>
    </Tabs>
  );
}
