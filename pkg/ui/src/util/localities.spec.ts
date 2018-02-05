import { assert } from "chai";

import * as protos from "src/js/protos";
import { LocalityTier, LocalityTree } from "src/redux/localities";
import {
  generateLocalityRoute,
  parseLocalityRoute,
  getNodeLocalityTiers,
  getChildLocalities,
  getLocality,
} from "./localities";

describe("parseLocalityRoute", function() {
  describe("with an empty route", function() {
    it("returns an empty array when passed undefined", function() {
      const tiers = parseLocalityRoute(undefined);

      assert.deepEqual(tiers, []);
    });

    it("returns an empty array when passed an empty string", function() {
      const tiers = parseLocalityRoute("");

      assert.deepEqual(tiers, []);
    });
  });

  describe("with a single-segment route", function() {
    it("returns an array with a single tier", function() {
      const key = "region";
      const value = "us-east-1";

      const tiers = parseLocalityRoute(key + "=" + value);

      assert.deepEqual(tiers, [{ key, value }]);
    });
  });

  describe("with a multi-segment route", function() {
    it("returns an array with all the tiers in the route", function() {
      const expectedTiers: LocalityTier[] = [
        { key: "region", value: "us-east" },
        { key: "zone", value: "us-east-1" },
        { key: "datacenter", value: "us-east-1b" },
      ];

      const route = expectedTiers
        .map(({ key, value }) => key + "=" + value)
        .join("/");

      const tiers = parseLocalityRoute(route);

      assert.deepEqual(tiers, expectedTiers);
    });
  });
});

describe("generateLocalityRoute", function() {
  describe("with empty tiers", function() {
    it("returns an empty string", function() {
      const route = generateLocalityRoute([]);

      assert.equal(route, "");
    });
  });

  describe("with a single tier", function() {
    it("returns a route with a single segment", function() {
      const key = "region";
      const value = "us-east-1";

      const route = generateLocalityRoute([{ key, value }]);

      assert.equal(route, key + "=" + value);
    });
  });

  describe("with multiple tiers", function() {
    it("returns a route with a segment for each tier", function() {
      const tiers: LocalityTier[] = [
        { key: "region", value: "us-east" },
        { key: "zone", value: "us-east-1" },
        { key: "datacenter", value: "us-east-1b" },
      ];

      const expectedRoute = tiers
        .map(({ key, value }) => key + "=" + value)
        .join("/");

      const route = generateLocalityRoute(tiers);

      assert.equal(route, expectedRoute);
    });
  });
});

describe("getNodeLocalityTiers", function() {
  it("returns the locality of a node", function() {
    const tiers: protos.cockroach.roachpb.Tier$Properties[] = [
      { key: "region", value: "us-east" },
      { key: "zone", value: "us-east-1" },
      { key: "datacenter", value: "us-east-1b" },
    ];
    const node = {
      desc: {
        locality: {
          tiers: tiers,
        },
      },
    };

    const locality = getNodeLocalityTiers(node);

    assert.deepEqual(locality, tiers);
  });
});

describe("getChildLocalities", function() {
  describe("with no children", function() {
    it("returns an empty list", function() {
      const locality: LocalityTree = {
        tiers: [],
        localities: {},
        nodes: [],
      };

      const children = getChildLocalities(locality);

      assert.deepEqual(children, []);
    });
  });

  describe("with child localities", function() {
    it("returns a list of the children", function() {
      const usEast: LocalityTree = {
        tiers: [{ key: "region", value: "us-east" }],
        localities: {},
        nodes: [],
      };

      const usWest: LocalityTree = {
        tiers: [{ key: "region", value: "us-west" }],
        localities: {},
        nodes: [],
      };

      const locality: LocalityTree = {
        tiers: [],
        localities: {
          region: {
            "us-east": usEast,
            "us-west": usWest,
          },
        },
        nodes: [],
      };

      const children = getChildLocalities(locality);

      assert.lengthOf(children, 2);
      assert.deepInclude(children, usEast);
      assert.deepInclude(children, usWest);
    });
  });
});

describe("getLocality", function() {
  const localityTree: LocalityTree = {
    tiers: [],
    localities: {
      region: {
        "us-east": {
          tiers: [{ key: "region", value: "us-east" }],
          localities: {
            zone: {
              "us-east-1": {
                tiers: [
                  { key: "region", value: "us-east" },
                  { key: "zone", value: "us-east-1" },
                ],
                localities: {},
                nodes: [
                  {
                    desc: {
                      node_id: 1,
                      locality: {
                        tiers: [
                          { key: "region", value: "us-east" },
                          { key: "zone", value: "us-east-1" },
                        ],
                      },
                    },
                  },
                ],
              },
            },
          },
          nodes: [],
        },
      },
    },
    nodes: [],
  };

  describe("with an empty list of tiers", function() {
    it("returns the original locality tree", function() {
      const tiers: LocalityTier[] = [];

      const tree = getLocality(localityTree, tiers);

      assert.deepEqual(tree, localityTree);
    });
  });

  describe("with a single tier", function() {
    it("returns the child locality if the tier exists", function() {
      const tiers: LocalityTier[] = [{ key: "region", value: "us-east" }];

      const tree = getLocality(localityTree, tiers);

      assert.deepEqual(tree, localityTree.localities.region["us-east"]);
    });

    it("returns null if the tier key does not exist", function() {
      const tiers: LocalityTier[] = [{ key: "country", value: "us-east" }];

      const tree = getLocality(localityTree, tiers);

      assert.equal(tree, null);
    });

    it("returns null if the tier value does not exist", function() {
      const tiers: LocalityTier[] = [{ key: "region", value: "eu-north" }];

      const tree = getLocality(localityTree, tiers);

      assert.equal(tree, null);
    });
  });

  describe("with multiple tiers", function() {
    it("returns the grandchild locality if the tiers exist", function() {
      const tiers: LocalityTier[] = [
        { key: "region", value: "us-east" },
        { key: "zone", value: "us-east-1" },
      ];

      const tree = getLocality(localityTree, tiers);

      assert.deepEqual(tree, localityTree.localities.region["us-east"].localities.zone["us-east-1"]);
    });

    it("returns null if the first tier key does not exist", function() {
      const tiers: LocalityTier[] = [
        { key: "country", value: "us-east" },
        { key: "zone", value: "us-east-1" },
      ];

      const tree = getLocality(localityTree, tiers);

      assert.equal(tree, null);
    });

    it("returns null if the first tier value does not exist", function() {
      const tiers: LocalityTier[] = [
        { key: "region", value: "eu-north" },
        { key: "zone", value: "us-east-1" },
      ];

      const tree = getLocality(localityTree, tiers);

      assert.equal(tree, null);
    });

    it("returns null if the second tier key does not exist", function() {
      const tiers: LocalityTier[] = [
        { key: "region", value: "us-east" },
        { key: "datacenter", value: "us-east-1" },
      ];

      const tree = getLocality(localityTree, tiers);

      assert.equal(tree, null);
    });

    it("returns null if the second tier value does not exist", function() {
      const tiers: LocalityTier[] = [
        { key: "region", value: "us-east" },
        { key: "zone", value: "us-east-42" },
      ];

      const tree = getLocality(localityTree, tiers);

      assert.equal(tree, null);
    });
  });
});
