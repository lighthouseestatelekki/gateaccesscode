
import { Clock } from "lucide-react";
import { HadithLine, Hero, Screen, Sheet, Wordmark } from "@/components/lh/ui";

export const title = "Registration received";

function Pending() {
  return (
    <Screen>
      <Hero className="pb-20">
        <Wordmark />
      </Hero>
      <Sheet className="flex flex-col">
        <div className="mx-auto -mt-16 flex size-20 items-center justify-center rounded-full bg-gold-light text-gold-text ring-8 ring-card">
          <Clock className="size-9" />
        </div>
        <div className="mt-6 text-center">
          <h1 className="text-3xl font-semibold">JazakAllahu Khairan.</h1>
          <p className="mx-auto mt-3 max-w-xs text-lg leading-relaxed text-text-2">Under review by the Estate Manager, usually within 24 hours.</p>
        </div>
        <HadithLine className="mt-auto pt-16" />
      </Sheet>
    </Screen>
  );
}

export default Pending;
