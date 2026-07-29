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
import { createClient } from "@/lib/supabase/client";

/**
 * Holds the signed-in user's identity and the term in view. Role and name come
 * from the user's real profile (set at sign-up / invite) — there is no role
 * switcher; access is what the account actually has. The term is a UI filter
 * over the current session.
 */
interface ViewerState {
  school: School | null;
  session: Session | null;
  role: Role;
  actorName: string;
  userId: string | null;
  term: TermName;
  setTerm: (t: TermName) => void;
  ready: boolean;
}

const ViewerContext = createContext<ViewerState | null>(null);

export function ViewerProvider({ children }: { children: ReactNode }) {
  const [school, setSchool] = useState<School | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role>("bursar");
  const [actorName, setActorName] = useState<string>("");
  const [userId, setUserId] = useState<string | null>(null);
  const [term, setTerm] = useState<TermName>("first");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        setUserId(user.id);

        const { data: profile } = await supabase
          .from("profiles")
          .select("role, full_name")
          .eq("id", user.id)
          .maybeSingle();
        if (cancelled) return;
        if (profile) {
          setRole(profile.role as Role);
          setActorName(profile.full_name as string);
        }

        const [s, sess] = await Promise.all([
          repository.getSchool(),
          repository.getSession(),
        ]);
        if (cancelled) return;
        setSchool(s);
        setSession(sess);
        setTerm(s.currentTerm);
      } catch {
        // No school yet (onboarding) or signed out — render without context.
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<ViewerState>(
    () => ({ school, session, role, actorName, userId, term, setTerm, ready }),
    [school, session, role, actorName, userId, term, ready],
  );

  return <ViewerContext.Provider value={value}>{children}</ViewerContext.Provider>;
}

export function useViewer(): ViewerState {
  const ctx = useContext(ViewerContext);
  if (!ctx) throw new Error("useViewer must be used within ViewerProvider");
  return ctx;
}
