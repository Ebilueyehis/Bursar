"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Role, School, Session, TermName } from "@/lib/domain/types";
import { repository } from "@/lib/data/repository";

/**
 * Holds who is using Bursar right now and the term in view. In production the
 * role comes from the signed-in user's profile; in this prototype we expose a
 * role switcher so all three role experiences can be demonstrated. The term is
 * a UI-level filter over the current session.
 */
interface ViewerState {
  school: School | null;
  session: Session | null;
  role: Role;
  setRole: (r: Role) => void;
  actorName: string;
  term: TermName;
  setTerm: (t: TermName) => void;
  ready: boolean;
}

const ViewerContext = createContext<ViewerState | null>(null);

const ACTOR_NAMES: Record<Role, string> = {
  proprietor: "Mrs. Adunni Bello",
  bursar: "Mr. Emeka Okoro",
  teacher: "Miss Halima Yusuf",
};

export function ViewerProvider({ children }: { children: ReactNode }) {
  const [school, setSchool] = useState<School | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role>("bursar");
  const [term, setTerm] = useState<TermName>("first");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([repository.getSchool(), repository.getSession()]).then(
      ([s, sess]) => {
        if (cancelled) return;
        setSchool(s);
        setSession(sess);
        setTerm(s.currentTerm);
        setReady(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<ViewerState>(
    () => ({
      school,
      session,
      role,
      setRole,
      actorName: ACTOR_NAMES[role],
      term,
      setTerm,
      ready,
    }),
    [school, session, role, term, ready],
  );

  return (
    <ViewerContext.Provider value={value}>{children}</ViewerContext.Provider>
  );
}

export function useViewer(): ViewerState {
  const ctx = useContext(ViewerContext);
  if (!ctx) throw new Error("useViewer must be used within ViewerProvider");
  return ctx;
}
