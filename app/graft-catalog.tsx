"use client";

export type GraftKey =
  | "bow-gunner" | "needle-lattice" | "rupture-bloom" | "scute-borer"
  | "funeral-lung" | "bone-harpoon" | "butchers-reel" | "top-gunner"
  | "rib-mortar-brood" | "whelping-shot" | "battering-sternum"
  | "trenchquake-bladders" | "scar-larder" | "rifle-choir" | "sapper-brood"
  | "trench-teeth" | "witness-cilia" | "common-shelter" | "munition-womb";

export type GraftChoice = {
  key: GraftKey;
  title: string;
  tree: string;
};

type Graft = GraftChoice & {
  family: "LIVING ARSENAL" | "BREACH BODY" | "WAR PARTY";
  description: string;
  future: string;
  delta: string;
  atlasCell: number;
};

const GRAFTS: Graft[] = [
  { key:"bow-gunner", title:"Bow Gunner", tree:"LIVING ARSENAL I · ROOT", family:"LIVING ARSENAL", atlasCell:0,
    description:"Grow one forward needle-mouth. Its single missile is the root body every later Arsenal mutation must transform.",
    future:"Opens Lattice saturation or Harpoon execution; choosing either seals the other.", delta:"NO MISSILE → ONE LIVING NEEDLE" },
  { key:"needle-lattice", title:"Needle Lattice", tree:"LIVING ARSENAL II · FISSION BRANCH", family:"LIVING ARSENAL", atlasCell:1,
    description:"The one missile cleaves into three divergent needles. Choosing this seals the Bone Harpoon lineage for this run.",
    future:"Opens Rupture Bloom, Scute Borer, then Funeral Lung.", delta:"ONE MISSILE → THREE DIVERGENT NEEDLES" },
  { key:"rupture-bloom", title:"Rupture Bloom", tree:"LIVING ARSENAL III · DETONATION", family:"LIVING ARSENAL", atlasCell:9,
    description:"Every lattice needle flowers on contact, tearing clustered trench bodies apart instead of merely striking one.",
    future:"Opens penetration through the first body.", delta:"THREE IMPACTS → THREE DETONATIONS" },
  { key:"scute-borer", title:"Scute Borer", tree:"LIVING ARSENAL IV · PENETRATION", family:"LIVING ARSENAL", atlasCell:2,
    description:"Rupture needles stay alive through their first victim. Three explosions become a line of six possible wounds.",
    future:"Opens the persistent toxic-acre capstone.", delta:"DETONATE → PENETRATE → DETONATE AGAIN" },
  { key:"funeral-lung", title:"Funeral Lung", tree:"LIVING ARSENAL V · TOXIC CAPSTONE", family:"LIVING ARSENAL", atlasCell:10,
    description:"Every needle impact exhales a persistent poison acre. The volley kills now, then keeps the ground hostile behind it.",
    future:"Capstone: the ground remains hostile after the volley passes.", delta:"EVERY WOUND → A PERSISTENT TOXIC ACRE" },
  { key:"bone-harpoon", title:"Bone Harpoon", tree:"LIVING ARSENAL II · HUNTER BRANCH", family:"LIVING ARSENAL", atlasCell:2,
    description:"Keep one missile and make it monstrous: it hunts specialists first and punches through two bodies. Needle Lattice closes.",
    future:"Opens Butcher's Reel specialist executions.", delta:"ONE NEEDLE → SPECIALIST-HUNTING DOUBLE PENETRATION" },
  { key:"butchers-reel", title:"Butcher's Reel", tree:"LIVING ARSENAL III · EXECUTION CAPSTONE", family:"LIVING ARSENAL", atlasCell:6,
    description:"A harpooned specialist ruptures into every nearby defender. Fewer shots; a prepared position dies all at once.",
    future:"Capstone: one prepared specialist becomes the position's failure point.", delta:"SPECIALIST KILL → THE WHOLE POSITION RUPTURES" },
  { key:"top-gunner", title:"Top Gunner", tree:"ARSENAL · INDEPENDENT BODY", family:"LIVING ARSENAL", atlasCell:0,
    description:"Grow another crown-mouth with its own traverse and rhythm. It hunts observers, carriers, and exposed flanks.",
    future:"May cross with Whelping Shot while the bow lineage remains independent.", delta:"NO CROWN-MOUTH → AUTONOMOUS SPECIALIST HUNTER" },
  { key:"rib-mortar-brood", title:"Rib-Mortar Brood", tree:"ARSENAL · INDEPENDENT BODY", family:"LIVING ARSENAL", atlasCell:5,
    description:"Grow another rib-mouth. Each coughs a separate cyst shell over the parapet and into the nearest trench body.",
    future:"Crosses with Whelping Shot into a Rib Nursery.", delta:"DIRECT FIRE → AN ORGAN THAT COUGHS OVER COVER" },
  { key:"whelping-shot", title:"Whelping Shot", tree:"ARSENAL · HEREDITARY TRAIT", family:"LIVING ARSENAL", atlasCell:8,
    description:"Every landship impact births forward-running tooth larvae. The new body changes every existing weapon at once.",
    future:"Crosses with Bow Gunner or Rib-Mortar; both parent organs remain.", delta:"IMPACT → FORWARD-RUNNING TOOTH LARVAE" },
  { key:"battering-sternum", title:"Battering Sternum", tree:"BREACH BODY · LOAD-BEARING ANATOMY", family:"BREACH BODY", atlasCell:3,
    description:"Lock a wider prow rib under twin-tread commitment. Soft bodies crush sooner and the impact becomes usable force.",
    future:"Opens sideways Trenchquake or wound-fed Scar Larder.", delta:"COLLISION → COMMITTED BREACH ANATOMY" },
  { key:"trenchquake-bladders", title:"Trenchquake Bladders", tree:"BREACH BODY · FORCE ROUTER", family:"BREACH BODY", atlasCell:4,
    description:"A successful ram vents sideways through the trench, breaking nearby defenders and flattening sandbag strongpoints.",
    future:"Crosses with Rifle Choir into War Convulsion.", delta:"FORWARD RAM → SIDEWAYS TRENCHQUAKE" },
  { key:"scar-larder", title:"Scar Larder", tree:"BREACH BODY · CARRION REPAIR", family:"BREACH BODY", atlasCell:4,
    description:"A committed sternum kill packs stolen tissue into the landship's worst open plate. Healing requires impact, danger, and a body actually taken.",
    future:"Battering Sternum becomes a risk-to-repair engine; it never heals by waiting.", delta:"STERNUM KILL → WORST OPEN SCUTE CLOTTED" },
  { key:"rifle-choir", title:"Rifle Choir", tree:"WAR PARTY · INDEPENDENT VOICE", family:"WAR PARTY", atlasCell:5,
    description:"Surviving riflemen grow another shared breathing voice. Each voice fires its own staggered trench volley.",
    future:"Opens Witness Cilia and Common Shelter doctrine.", delta:"ESCORT → AUTONOMOUS STAGGERED VOLLEY" },
  { key:"sapper-brood", title:"Sapper Brood", tree:"WAR PARTY · BREACH BODY", family:"WAR PARTY", atlasCell:6,
    description:"Grow another tendon-tool file in the wake. Sappers rip rooted hair, crush abandoned cover, and bite hardpoints.",
    future:"Crosses with Trench Teeth into an Occupation Maw.", delta:"FOLLOWERS → OBSTACLE-EATING BREACH BODY" },
  { key:"trench-teeth", title:"Trench Teeth", tree:"WAR PARTY · OCCUPATION ORGAN", family:"WAR PARTY", atlasCell:7,
    description:"Every captured trench grows another allied weapon-mouth that keeps firing into the next German line.",
    future:"Opens selective counter-armor through Munition Womb.", delta:"CAPTURED GROUND → A DEFENSIVE WEAPON-MOUTH" },
  { key:"witness-cilia", title:"Witness Cilia", tree:"WAR PARTY · COUNTERBATTERY SENSE", family:"WAR PARTY", atlasCell:5,
    description:"The Rifle Choir shares one twitching sightline. Its first volley hunts observers and tears the correction out of an unregistered barrage.",
    future:"Rifle fire gains a declared observer priority without increasing raw damage.", delta:"RIFLE VOLLEY → OBSERVER THROAT FIRST" },
  { key:"common-shelter", title:"Common Shelter", tree:"WAR PARTY · CASUALTY PROTOCOL", family:"WAR PARTY", atlasCell:3,
    description:"Under incoming artillery the choir folds into a living scute around the casualty route. Fire pauses; fewer bodies are spent.",
    future:"Artillery remains lethal and loud; connected infantry trade fire support for survival.", delta:"INCOMING BARRAGE → FIRE WITHHELD, CASUALTIES SHELTERED" },
  { key:"munition-womb", title:"Munition Womb", tree:"WAR PARTY · OCCUPATION CAPSTONE", family:"WAR PARTY", atlasCell:7,
    description:"Captured Trench Teeth gestate one heavy bone round for enemy carriers and anti-armor organs instead of chewing every target alike.",
    future:"Held ground becomes selective counter-armor, not a passive damage aura.", delta:"CAPTURED MOUTH → SELECTIVE COUNTER-ARMOR ROUND" },
];

const byKey = new Map(GRAFTS.map((graft) => [graft.key, graft]));
const atlasPosition = (cell:number) => `${(cell % 4) * (100 / 3)}% ${Math.floor(cell / 4) * 50}%`;

export default function GraftCatalog({
  offerKeys,
  onChoose,
}: {
  offerKeys: GraftKey[];
  onChoose: (choice: GraftChoice) => void;
}) {
  return (
    <section className="upgrade-screen">
      <p className="eyebrow">THE FIELD FEEDS THE LANDSHIP</p>
      <h2>GRAFT AN ORGAN</h2>
      <div className="upgrade-grid">
        {offerKeys.map((key) => byKey.get(key)).filter((graft): graft is Graft => Boolean(graft)).map((graft) => (
          <button key={graft.key} className="upgrade-card" onClick={() => onChoose(graft)}>
            <span className="graft-family">{graft.family}</span>
            <span className="graft-organ" aria-hidden="true" style={{ backgroundPosition: atlasPosition(graft.atlasCell) }} />
            <span>{graft.tree}</span>
            <strong>{graft.title}</strong>
            <p>{graft.description}</p>
            <em className="graft-future">NEXT: {graft.future}</em>
            <small>{graft.delta}<br />RUN-LOCAL MUTATION · THE BUILD DIES · PREVIOUS ORGANS REMAIN</small>
          </button>
        ))}
      </div>
    </section>
  );
}
