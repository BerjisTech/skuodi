declare module 'clipper-lib' {
  namespace ClipperLib {
    interface IntPoint {
      X: number;
      Y: number;
    }

    type Path = IntPoint[];

    class Paths extends Array<Path> {}

    enum PolyType {
      ptSubject,
      ptClip,
    }

    enum ClipType {
      ctIntersection,
      ctUnion,
      ctDifference,
      ctXor,
    }

    enum PolyFillType {
      pftEvenOdd,
      pftNonZero,
      pftPositive,
      pftNegative,
    }

    class Clipper {
      AddPaths(paths: Path[] | Paths, polyType: PolyType, closed: boolean): boolean;
      Execute(
        clipType: ClipType,
        solution: Paths,
        subjFillType: PolyFillType,
        clipFillType: PolyFillType
      ): boolean;
    }
  }

  const ClipperLib: {
    Clipper: typeof ClipperLib.Clipper;
    Paths: typeof ClipperLib.Paths;
    PolyType: typeof ClipperLib.PolyType;
    ClipType: typeof ClipperLib.ClipType;
    PolyFillType: typeof ClipperLib.PolyFillType;
  };

  export = ClipperLib;
}
