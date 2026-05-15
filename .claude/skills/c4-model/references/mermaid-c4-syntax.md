# Mermaid C4 Syntax Reference

## Diagram types
```
C4Context    → L1 System Context
C4Container  → L2 Containers
C4Component  → L3 Components
C4Dynamic    → Sequence/dynamic interactions
C4Deployment → Infrastructure deployment
```

## L1 (C4Context) elements
```
Person(id, label, ?descr)
Person_Ext(id, label, ?descr)
System(id, label, ?descr)
System_Ext(id, label, ?descr)
SystemDb(id, label, ?descr)
SystemDb_Ext(id, label, ?descr)
SystemQueue(id, label, ?descr)
Enterprise_Boundary(id, label) { ... }
```

## L2 (C4Container) elements
```
Container(id, label, ?techn, ?descr)
ContainerDb(id, label, ?techn, ?descr)
ContainerQueue(id, label, ?techn, ?descr)
Container_Ext(id, label, ?techn, ?descr)
Container_Boundary(id, label) { ... }
```

## L3 (C4Component) elements
```
Component(id, label, ?techn, ?descr)
ComponentDb(id, label, ?techn, ?descr)
Component_Ext(id, label, ?techn, ?descr)
```

## Relationships (all diagrams)
```
Rel(from, to, label, ?techn)
BiRel(from, to, label, ?techn)
Rel_Up / Rel_Down / Rel_Left / Rel_Right (directional hints)
```

## Styling
```
UpdateElementStyle(id, ?bgColor, ?fontColor, ?borderColor)
UpdateRelStyle(from, to, ?textColor, ?lineColor, ?offsetX, ?offsetY)
UpdateLayoutConfig(?shapesPerRow, ?boundariesPerRow)  ← default 4, 2
```

## Boundaries can nest
```
System_Boundary(s, "System") {
  Container_Boundary(c, "Container") {
    Component(x, "X", "tech", "descr")
  }
}
```

## Known limits
- No sprites, tags, or $link support
- No automatic layout direction (Lay_U etc. unsupported)
- Statement order influences layout — put primary elements first
- Keep total node count <25 per diagram for readability
