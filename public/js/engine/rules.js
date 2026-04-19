/**
 * Diamond IQ — Baseball vs Softball Little League Rules
 * Comprehensive rule reference with helpers for sport/tier queries.
 */

export const RULES = {
  baseball: {
    bases: 90, // feet (regulation); LL uses 60ft but we store regulation default
    basesLL: 60,
    pitchingDistance: 60.5, // feet (regulation); LL is 46ft
    pitchingDistanceLL: 46,
    leadoffs: true,
    stealing: {
      tball: false,
      rookie: false,
      minors: true, // can steal once ball crosses the plate
      majors: true,
      'the-show': true,
    },
    stealingNotes: {
      tball: 'No stealing allowed at T-Ball level.',
      rookie: 'No stealing allowed at Rookie level.',
      minors:
        'Runners may steal once the pitch crosses the plate. No delayed steals on overthrows in most leagues.',
      majors:
        'Full stealing rules. Runners may lead off and steal at any time.',
      'the-show':
        'Full stealing rules including delayed steals, double steals, and steal of home.',
    },
    infieldFly: true,
    droppedThirdStrike: true,
    balks: true,
    innings: {
      littleLeague: 6,
      regulation: 9,
    },
    mercyRule: {
      littleLeague: {
        runDifference: 10,
        afterInning: 4,
        description:
          'Game ends if a team leads by 10 or more runs after 4 innings (3.5 if home team leads).',
      },
      perInning: {
        tball: 5,
        rookie: 5,
        minors: 5,
        majors: null, // no per-inning cap at Majors
        'the-show': null,
      },
    },
    pitchCount: {
      littleLeague: {
        daily: { age11_12: 85, age9_10: 75, age7_8: 50 },
        restDays:
          'Rest days required based on pitches thrown (1-20: 0 days, 21-35: 1 day, 36-50: 2 days, 51-65: 3 days, 66+: 4 days).',
      },
    },
    batAround: {
      tball: true,
      rookie: true,
      minors: false,
      majors: false,
      'the-show': false,
    },
  },

  softball: {
    bases: 60, // feet (all levels)
    pitchingDistance: 43, // feet (regulation); LL is 35ft
    pitchingDistanceLL: 35,
    leadoffs: false,
    stealing: {
      tball: false,
      rookie: false,
      minors: false, // more restricted than baseball
      majors: true, // can steal once ball leaves the pitcher's hand
      'the-show': true,
    },
    stealingNotes: {
      tball: 'No stealing allowed at T-Ball level.',
      rookie: 'No stealing allowed at Rookie level.',
      minors:
        'No stealing allowed at Minors level in most softball leagues.',
      majors:
        'Runners may steal once the ball leaves the pitcher\'s hand. No leadoffs — must stay on the base until release.',
      'the-show':
        'Full stealing rules. Runners may steal once the ball is released. Delayed steals and double steals allowed.',
    },
    infieldFly: true,
    balks: false,
    illegalPitch: true, // softball uses "illegal pitch" instead of balk
    runRule: true,
    runRuleDetails: {
      runDifference: 12,
      afterInning: 3,
      description:
        'Game ends if a team leads by 12+ after 3 innings, or 10+ after 4 innings, or 8+ after 5 innings.',
    },
    innings: {
      littleLeague: 6,
      regulation: 7,
    },
    pitchingStyle: 'underhand',
    dropThirdStrike: {
      littleLeague: false,
      regulation: true,
    },
    bunting: {
      tball: false,
      rookie: false,
      minors: true,
      majors: true,
      'the-show': true,
    },
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Can runners steal at this sport + tier combination?
 * @param {"baseball"|"softball"} sport
 * @param {string} tier — "tball", "rookie", "minors", "majors", "the-show"
 * @returns {boolean}
 */
export function canSteal(sport, tier) {
  const sportRules = RULES[sport];
  if (!sportRules || !sportRules.stealing) return false;
  return !!sportRules.stealing[tier];
}

/**
 * Can runners take leadoffs in this sport?
 * @param {"baseball"|"softball"} sport
 * @returns {boolean}
 */
export function canLeadOff(sport) {
  const sportRules = RULES[sport];
  if (!sportRules) return false;
  return !!sportRules.leadoffs;
}

/**
 * Get a human-readable explanation of how a rule differs between baseball and softball.
 * @param {string} rule — one of: "stealing", "leadoffs", "infieldFly", "balks", "bases",
 *                         "pitchingDistance", "innings", "mercyRule", "dropThirdStrike"
 * @param {"baseball"|"softball"} sport — which sport's perspective to explain from
 * @returns {string}
 */
export function getRuleExplanation(rule, sport) {
  const explanations = {
    stealing: {
      baseball:
        'In baseball, stealing is introduced at the Minors level. Runners can steal once the pitch crosses the plate, and at Majors+ they can lead off and steal freely.',
      softball:
        'In softball, stealing is more restricted. It is not allowed until Majors level, and even then runners cannot leave the base until the ball leaves the pitcher\'s hand. There are no leadoffs.',
    },
    leadoffs: {
      baseball:
        'In baseball, runners are allowed to take leadoffs from the base. This opens up steal attempts, pick-off plays, and hit-and-run strategies.',
      softball:
        'In softball, runners may NOT take leadoffs. They must stay in contact with the base until the pitcher releases the ball. This is a fundamental difference from baseball.',
    },
    infieldFly: {
      baseball:
        'The infield fly rule applies in baseball when there are runners on 1st and 2nd (or bases loaded) with less than 2 outs. A fair fly ball that can be caught by an infielder with ordinary effort results in an automatic out, preventing the defense from intentionally dropping the ball to turn a double play.',
      softball:
        'The infield fly rule applies in softball just like in baseball — runners on 1st and 2nd (or bases loaded) with less than 2 outs. The batter is automatically out on a catchable fair fly ball in the infield.',
    },
    balks: {
      baseball:
        'In baseball, a balk is called when the pitcher makes an illegal motion on the mound that could deceive a runner. All runners advance one base. Balks include failing to come set, faking a throw to first, and other deceptive motions.',
      softball:
        'Softball does not have balks. Instead, there is an "illegal pitch" rule. Since pitchers throw underhand and runners cannot lead off, the deception concerns are different. An illegal pitch results in a ball being called.',
    },
    bases: {
      baseball:
        'In baseball, the base paths are 90 feet in regulation (60 feet in Little League). The longer distance affects steal timing, relay throws, and base-running decisions.',
      softball:
        'In softball, the base paths are 60 feet at all levels. The shorter distance makes the game faster-paced and changes the geometry of defensive plays.',
    },
    pitchingDistance: {
      baseball:
        'In baseball, the pitching distance is 60 feet 6 inches in regulation (46 feet in Little League). The longer distance gives batters more reaction time.',
      softball:
        'In softball, the pitching distance is 43 feet in regulation (35 feet in Little League). The shorter distance combined with underhand pitching creates a different timing challenge for batters.',
    },
    innings: {
      baseball:
        'A regulation baseball game is 9 innings (6 in Little League). The mercy rule can end a game early if one team has a large lead after a certain number of innings.',
      softball:
        'A regulation softball game is 7 innings (6 in Little League). The run rule (mercy rule) is more aggressive — games can end after 3 innings with a 12-run lead.',
    },
    mercyRule: {
      baseball:
        'In Little League baseball, the mercy rule ends the game when a team leads by 10+ runs after 4 innings. Some levels also have per-inning run limits (5 runs per inning at T-Ball through Minors).',
      softball:
        'In softball, the run rule is tiered: 12+ after 3 innings, 10+ after 4 innings, or 8+ after 5 innings. This keeps games from becoming one-sided blowouts.',
    },
    dropThirdStrike: {
      baseball:
        'In baseball, the dropped third strike rule allows the batter to attempt to reach first base if the catcher fails to cleanly catch the third strike (with first base unoccupied or two outs). This applies at all levels.',
      softball:
        'In Little League softball, the dropped third strike rule typically does NOT apply. In regulation softball, it does apply. This is a key difference kids learn as they advance.',
    },
  };

  const ruleExplanations = explanations[rule];
  if (!ruleExplanations) {
    return `No explanation available for rule "${rule}".`;
  }
  return ruleExplanations[sport] || `No explanation available for "${rule}" in ${sport}.`;
}
