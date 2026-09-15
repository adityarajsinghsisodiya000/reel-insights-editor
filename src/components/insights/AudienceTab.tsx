import { useState } from "react";
import { useInsights } from "@/lib/insights-store";
import { redistributePercentages, redistributeAndSort } from "@/lib/utils";
import { ProgressRow, SectionTitle } from "./Rows";

export function AudienceTab() {
  const { data, update } = useInsights();
  const a = data.audience;
  const [activeCategory, setActiveCategory] = useState("Country");

  const rows = activeCategory === "Age"
    ? a.age
    : activeCategory === "Gender"
    ? a.gender
    : a.country;

  const handlePercentageChange = (idx: number, val: number) => {
    if (activeCategory === "Country") {
      update((d) => {
        d.audience.country = redistributeAndSort(d.audience.country, idx, val);
      });
    } else if (activeCategory === "Age") {
      update((d) => {
        d.audience.age = redistributePercentages(d.audience.age, idx, val);
      });
    } else {
      update((d) => {
        d.audience.gender = redistributePercentages(d.audience.gender, idx, val);
      });
    }
  };

  return (
    <div>
      <SectionTitle title={a.whoTitle} onChange={(v) => update((d) => { d.audience.whoTitle = v; })} />
      <div className="mt-3">
        {a.who.map((r, i) => (
          <ProgressRow
            key={r.id}
            name={r.name}
            percentage={r.percentage}
            color={r.name === "Non-followers" ? "purple" : "magenta"}
            onName={(v) => update((d) => { d.audience.who[i]!.name = v; })}
            onPercentage={(v) => update((d) => { d.audience.who = redistributePercentages(d.audience.who, i, v); })}
          />
        ))}
      </div>

      <SectionTitle title={a.detailsTitle} onChange={(v) => update((d) => { d.audience.detailsTitle = v; })} />
      <div className="mb-3 flex gap-2">
        {["Age", "Country", "Gender"].map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setActiveCategory(c)}
            className={`rounded-full px-5 py-[9px] text-[14px] ${
              activeCategory === c
                ? "bg-ig-chip font-semibold text-ig-text"
                : "border border-ig-line text-ig-text"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {rows.map((r, i) => (
        <ProgressRow
          key={r.id}
          name={r.name}
          percentage={r.percentage}
          color={activeCategory === "Gender" && r.name === "Women" ? "purple" : "magenta"}
          onName={(v) => {
            if (activeCategory === "Country") {
              update((d) => { d.audience.country[i]!.name = v; });
            } else if (activeCategory === "Age") {
              update((d) => { d.audience.age[i]!.name = v; });
            } else {
              update((d) => { d.audience.gender[i]!.name = v; });
            }
          }}
          onPercentage={(v) => handlePercentageChange(i, v)}
        />
      ))}
    </div>
  );
}
