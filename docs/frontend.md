# Frontend architecture

## Goals

The interface should read as an orchestration product rather than a developer dashboard. The graph is the primary surface, the context sidebar explains the selected state, and the activity console remains secondary until opened.

## Stack

- Next.js App Router and React 19
- TypeScript with strict checks
- React Flow for DAG rendering and interaction
- Lucide React for a consistent icon language
- CSS cascade layers and design tokens for styling
- Vitest and Testing Library for component behavior

## Layout hierarchy

1. The top bar identifies the product and exposes run-level controls.
2. The summary bar explains the current orchestration state in one sentence.
3. The graph owns the largest area and visual emphasis.
4. The context sidebar shows one view at a time: overview, node, decision, graph change, or result.
5. The activity console provides detailed events on demand.

## Typography

The scale lives in styles/tokens.css. Product UI does not use text below 12px.

| Role | Size |
| --- | --- |
| Display | 40–48px |
| Section title | 18px |
| Body | 15–16px |
| Control | 13–15px |
| Metadata | 12px |

Metadata uses contrast and placement, not microscopic sizing, to remain secondary.

## Styling organization

    styles/index.css    import order and cascade layers
    styles/tokens.css   color, type, spacing, radius, motion tokens
    styles/base.css     document defaults and accessibility
    styles/shell.css    app chrome, launch view, responsive shell
    styles/graph.css    nodes, edges, controls, graph animation
    styles/sidebar.css  context views and decision surfaces
    styles/console.css  activity console

Avoid appending one-off overrides to the end of files. Change the owning component rule or introduce a semantic token. Prefer class names that describe purpose rather than appearance.

## Component organization

Orchestration components and their tests are colocated in features/orchestration/components. Route files remain thin. Server-only orchestration code remains in server, and framework-independent graph rules remain in packages/domain.

## Motion and accessibility

- Running nodes use a restrained glow, sweep, and activity signal.
- Graph replacement animates both nodes and edges.
- Motion is disabled when prefers-reduced-motion is enabled.
- Controls have visible keyboard focus states.
- Live run state is announced through an ARIA status region.
- Color is never the only status signal.

## Contribution rules

Before a pull request, run pnpm check. Do not commit environment files, build output, local workspace paths, tokens, screenshots, or packaged dependencies.
