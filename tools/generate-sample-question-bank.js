const fs = require('node:fs');
const path = require('node:path');

const SUBJECT_CODE = 'CSE3001';
const OUTPUT_DIRECTORY = path.join(__dirname, '..', 'sample-data');
const OUTPUT_PATH = path.join(OUTPUT_DIRECTORY, 'CSE3001-data-structures-question-bank-500.csv');

const modules = [];
const templates = [];

modules.push({
  moduleNumber: 1,
  topics: [
    {
      name: 'asymptotic analysis',
      purpose: 'comparing algorithm growth rates independently of machine-specific constants',
      useCase: 'justify the choice of the most scalable algorithm among competing solutions',
      workload: 'predicting behaviour as input size becomes very large',
      altWorkload: 'tuning constant factors for small fixed-size inputs',
      comparison: 'empirical benchmarking alone',
      commonOperation: 'deriving worst-case time complexity from code structure',
      pitfall: 'mixing best-case and worst-case reasoning or ignoring the dominant term',
      testCase: 'algorithms with clearly different growth rates over increasing input sizes',
      optimization: 'separating dominant terms from lower-order effects and constants',
      designGoal: 'justify an implementation choice before coding begins',
      mcqStem: 'Which notation expresses a tight asymptotic bound on an algorithm growth rate?',
      mcqOptions: ['Theta(n)', 'O(n)', 'Omega(n)', 'o(n)']
    },
    {
      name: 'recursion',
      purpose: 'solving a problem by reducing it to smaller instances of the same problem',
      useCase: 'develop a correct self-referential solution for a problem with natural substructure',
      workload: 'handling problems with clear self-similar decomposition',
      altWorkload: 'working in an environment with strict stack-space limits',
      comparison: 'iterative control flow',
      commonOperation: 'tracing recursive calls and returns',
      pitfall: 'missing a valid base case or failing to make progress toward it',
      testCase: 'empty input, smallest valid input, and deeply nested recursive calls',
      optimization: 'transforming tail-recursive logic into an equivalent iterative form',
      designGoal: 'solve a self-similar problem while reasoning about stack behaviour',
      mcqStem: 'What is the primary role of the base case in a recursive algorithm?',
      mcqOptions: [
        'It stops the recursion from continuing indefinitely',
        'It makes every recursive call take constant time',
        'It converts recursion into iteration automatically',
        'It guarantees the algorithm is optimal'
      ]
    },
    {
      name: 'dynamic array',
      purpose: 'maintaining a growable indexed sequence while preserving fast random access',
      useCase: 'store a sequence that grows gradually while keeping indexed reads efficient',
      workload: 'supporting frequent indexed reads with occasional append operations',
      altWorkload: 'performing frequent insertions and deletions at the front of the sequence',
      comparison: 'singly linked list',
      commonOperation: 'append with periodic resizing',
      pitfall: 'assuming every append is worst-case O(1) even during resize events',
      testCase: 'repeated append operations that trigger multiple capacity expansions',
      optimization: 'choosing an appropriate growth factor and reserve strategy',
      designGoal: 'balance indexing speed with manageable resize overhead',
      mcqStem: 'Which operation is amortized O(1) in a dynamic array that uses geometric resizing?',
      mcqOptions: [
        'Append at the end',
        'Insert at the beginning',
        'Delete from an arbitrary middle position',
        'Concatenate two unsized arrays without copying'
      ]
    },
    {
      name: 'singly linked list',
      purpose: 'representing a sequence through nodes linked in one direction',
      useCase: 'support efficient insertion and deletion after a known node reference',
      workload: 'performing frequent insertions and deletions near the head of the list',
      altWorkload: 'serving heavy random indexing by numeric position',
      comparison: 'dynamic array',
      commonOperation: 'insertion and deletion after pointer traversal',
      pitfall: 'losing the next reference during pointer updates',
      testCase: 'insertion into an empty list and deletion of the first node',
      optimization: 'using a head sentinel to simplify boundary handling',
      designGoal: 'support flexible sequence growth without contiguous memory',
      mcqStem: 'Which operation is usually efficient in a singly linked list once the target node is known?',
      mcqOptions: [
        'Insertion after the target node',
        'Random access by index',
        'Binary search over the list',
        'Backward traversal without extra links'
      ]
    },
    {
      name: 'doubly linked list',
      purpose: 'supporting bidirectional traversal with previous and next links',
      useCase: 'delete a known node or move in both forward and backward directions efficiently',
      workload: 'navigating sequences that require forward and backward traversal',
      altWorkload: 'operating under strict memory constraints with one-way scans only',
      comparison: 'singly linked list',
      commonOperation: 'insertion and deletion with both prev and next links',
      pitfall: 'updating one direction of linkage but forgetting the other',
      testCase: 'deleting the tail node and verifying reverse traversal',
      optimization: 'using sentinel head and tail nodes to simplify updates',
      designGoal: 'support symmetric traversal and easier deletion at the cost of extra space',
      mcqStem: 'What additional capability does a doubly linked list provide over a singly linked list?',
      mcqOptions: [
        'Backward traversal from a node',
        'Direct O(1) indexed access',
        'Automatic sorting after insertion',
        'Hash-based lookup by key'
      ]
    }
  ]
});

modules.push({
  moduleNumber: 2,
  topics: [
    {
      name: 'stack',
      purpose: 'managing last-in first-out processing for nested operations',
      useCase: 'handle expression evaluation, undo, and call-like nesting behaviour',
      workload: 'processing data where the most recent item must be handled first',
      altWorkload: 'serving requests strictly in arrival order',
      comparison: 'queue',
      commonOperation: 'push and pop',
      pitfall: 'allowing underflow or overflow conditions to go unchecked',
      testCase: 'long push-pop sequences and empty-stack access',
      optimization: 'choosing between array-based and linked implementations',
      designGoal: 'model LIFO control safely and efficiently',
      mcqStem: 'Which access pattern is implemented by a stack?',
      mcqOptions: ['Last in first out', 'First in first out', 'Smallest key first', 'Level by level']
    },
    {
      name: 'queue',
      purpose: 'managing first-in first-out processing for buffered requests',
      useCase: 'schedule or serve items in the same order in which they arrive',
      workload: 'preserving arrival order in buffered processing systems',
      altWorkload: 'reversing the most recent actions first',
      comparison: 'stack',
      commonOperation: 'enqueue and dequeue',
      pitfall: 'treating a linear-array queue as full even when reusable slots exist',
      testCase: 'wrap-around behaviour in a circular queue',
      optimization: 'using circular indexing to reuse freed positions',
      designGoal: 'preserve service order with bounded processing cost',
      mcqStem: 'Which data structure is best suited for first-in first-out service order?',
      mcqOptions: ['Queue', 'Stack', 'Heap', 'Trie']
    },
    {
      name: 'deque',
      purpose: 'allowing insertion and deletion at both ends of a sequence',
      useCase: 'support sliding-window processing and double-ended updates',
      workload: 'handling algorithms that need efficient operations at both front and rear',
      altWorkload: 'working with problems that only require one-end updates',
      comparison: 'queue',
      commonOperation: 'insertFront, insertRear, deleteFront, and deleteRear',
      pitfall: 'mismanaging front and rear pointers when the structure becomes empty',
      testCase: 'alternating front and rear operations until the deque empties',
      optimization: 'using a circular array representation for compact storage',
      designGoal: 'provide predictable double-ended updates',
      mcqStem: 'What distinguishes a deque from a simple queue?',
      mcqOptions: [
        'It supports insertion and deletion at both ends',
        'It stores keys only in sorted order',
        'It guarantees logarithmic search',
        'It uses hashing internally'
      ]
    },
    {
      name: 'hash table',
      purpose: 'storing key-value pairs for near-constant-time exact-match lookup',
      useCase: 'build a dictionary that supports rapid search by key',
      workload: 'performing many exact-match searches over a large set of keys',
      altWorkload: 'answering ordered range queries over the stored keys',
      comparison: 'binary search tree',
      commonOperation: 'insert, search, and delete under collisions',
      pitfall: 'ignoring load factor and collision behaviour until performance degrades',
      testCase: 'clustered keys and repeated rehash events under growing load',
      optimization: 'choosing a robust hash function and resizing policy',
      designGoal: 'maximize average-case lookup speed for exact-key access',
      mcqStem: 'Which factor most directly affects the performance of a hash table?',
      mcqOptions: ['Load factor', 'Tree height', 'Graph density', 'Matrix sparsity']
    },
    {
      name: 'disjoint set union',
      purpose: 'maintaining dynamic partitions of elements into non-overlapping sets',
      useCase: 'answer connectivity queries while sets are repeatedly merged',
      workload: 'performing many union and find operations over evolving groups',
      altWorkload: 'iterating over all members in sorted order',
      comparison: 'graph adjacency list',
      commonOperation: 'union by rank with path compression',
      pitfall: 'failing to merge roots correctly or to compress search paths',
      testCase: 'repeated find operations after a long chain of unions',
      optimization: 'combining path compression with rank or size heuristics',
      designGoal: 'answer membership and connectivity queries efficiently',
      mcqStem: 'Which pair of techniques is commonly used to optimize disjoint set union?',
      mcqOptions: [
        'Path compression and union by rank',
        'Breadth-first search and memoization',
        'Random pivoting and recursion unwinding',
        'Open addressing and rehashing'
      ]
    }
  ]
});

modules.push({
  moduleNumber: 3,
  topics: [
    {
      name: 'binary search tree',
      purpose: 'maintaining ordered keys so that search, insertion, and deletion follow key order',
      useCase: 'store searchable keys while preserving sorted traversal order',
      workload: 'performing ordered updates and in-order traversal over keys',
      altWorkload: 'handling adversarial insertion orders without rebalancing',
      comparison: 'hash table',
      commonOperation: 'search, insert, and delete by key comparison',
      pitfall: 'allowing tree height to degenerate under nearly sorted input',
      testCase: 'deleting a node with two children and verifying order preservation',
      optimization: 'rebalancing or choosing insertion strategies that limit height growth',
      designGoal: 'combine ordering semantics with efficient key search',
      mcqStem: 'Which traversal of a binary search tree returns keys in sorted order?',
      mcqOptions: ['In-order traversal', 'Pre-order traversal', 'Post-order traversal', 'Level-order traversal']
    },
    {
      name: 'AVL tree',
      purpose: 'maintaining a self-balancing ordered tree with bounded height',
      useCase: 'support fast ordered search while preserving logarithmic height after updates',
      workload: 'performing frequent searches with updates that must preserve balance',
      altWorkload: 'using write-heavy workloads where fewer balancing rotations are preferred',
      comparison: 'binary search tree',
      commonOperation: 'restoring balance with rotations after insertion or deletion',
      pitfall: 'choosing the wrong rotation for a given imbalance pattern',
      testCase: 'LL, RR, LR, and RL imbalance cases',
      optimization: 'storing balance factors or heights efficiently',
      designGoal: 'guarantee logarithmic search performance after updates',
      mcqStem: 'What property does an AVL tree maintain after every update?',
      mcqOptions: [
        'The height difference of the child subtrees stays within one',
        'All leaves stay on the same level',
        'The root always stores the median key',
        'Every node has exactly two children'
      ]
    },
    {
      name: 'max heap',
      purpose: 'maintaining a complete binary tree where every parent dominates its children',
      useCase: 'repeatedly retrieve and remove the maximum-priority element',
      workload: 'running priority scheduling and top-k style selection',
      altWorkload: 'supporting ordered range queries or full sorted traversal',
      comparison: 'binary search tree',
      commonOperation: 'insert, extract-max, and heapify',
      pitfall: 'violating heap order during sift-up or sift-down',
      testCase: 'repeated extract-max operations after bulk insertion',
      optimization: 'building the heap bottom-up instead of repeated single inserts',
      designGoal: 'support efficient priority removal with low extra space',
      mcqStem: 'Which element is always stored at the root of a max heap?',
      mcqOptions: ['The maximum element', 'The minimum element', 'The median element', 'The most recently inserted element']
    },
    {
      name: 'B-tree',
      purpose: 'indexing large ordered datasets with multiway nodes that reduce disk access',
      useCase: 'support efficient external-memory search and update operations',
      workload: 'searching and updating large datasets stored in blocks on disk',
      altWorkload: 'working only with tiny in-memory datasets',
      comparison: 'AVL tree',
      commonOperation: 'multiway search with node split and merge handling',
      pitfall: 'mishandling node split, merge, or redistribution cases',
      testCase: 'cascaded node splits from a leaf up to the root',
      optimization: 'choosing node order to match storage block size',
      designGoal: 'minimize disk I/O while preserving key order',
      mcqStem: 'Why are B-trees widely used in database indexing?',
      mcqOptions: [
        'They reduce disk access by storing many keys in one node',
        'They guarantee constant-time search',
        'They eliminate the need for deletion',
        'They store edges more efficiently than graphs'
      ]
    },
    {
      name: 'trie',
      purpose: 'storing strings by shared prefixes rather than by whole-key comparison',
      useCase: 'perform fast prefix search and autocomplete over a dictionary of strings',
      workload: 'answering many prefix-based queries over string keys',
      altWorkload: 'serving arbitrary ordered range queries on non-string keys',
      comparison: 'hash table',
      commonOperation: 'insert, search, and prefix traversal over characters',
      pitfall: 'wasting space through sparse child pointers or redundant nodes',
      testCase: 'keys where one valid word is also a prefix of another',
      optimization: 'compressing paths to reduce memory consumption',
      designGoal: 'support fast prefix retrieval with clear key structure',
      mcqStem: 'Which application is especially well suited to a trie?',
      mcqOptions: ['Autocomplete by prefix', 'Minimum spanning tree construction', 'Matrix multiplication', 'Binary heap sort']
    }
  ]
});

modules.push({
  moduleNumber: 4,
  topics: [
    {
      name: 'merge sort',
      purpose: 'sorting by dividing the input, sorting subproblems, and merging ordered results',
      useCase: 'sort records while preserving stability and predictable complexity',
      workload: 'sorting data where stability and guaranteed O(n log n) behaviour matter',
      altWorkload: 'sorting tiny arrays under strict in-place memory limits',
      comparison: 'quicksort',
      commonOperation: 'divide recursively and merge sorted halves',
      pitfall: 'implementing the merge step incorrectly or allocating temporary memory inefficiently',
      testCase: 'duplicate keys and partially sorted inputs',
      optimization: 'hybrid cutoffs and careful temporary-buffer management',
      designGoal: 'produce stable sorted output with predictable performance',
      mcqStem: 'Which sorting algorithm is stable and guarantees O(n log n) time in the worst case?',
      mcqOptions: ['Merge sort', 'Quicksort', 'Selection sort', 'Shell sort']
    },
    {
      name: 'quicksort',
      purpose: 'sorting in place by partitioning data around a pivot element',
      useCase: 'perform fast practical in-memory sorting on average',
      workload: 'sorting arrays efficiently when good pivot choices are available',
      altWorkload: 'requiring guaranteed worst-case bounds regardless of input arrangement',
      comparison: 'merge sort',
      commonOperation: 'partition the array around a pivot and recurse on subarrays',
      pitfall: 'using poor pivot selection that causes highly unbalanced partitions',
      testCase: 'already sorted arrays and arrays with many repeated keys',
      optimization: 'randomized pivoting or median-of-three selection',
      designGoal: 'achieve fast practical sorting with low auxiliary space',
      mcqStem: 'What is the key operation in quicksort?',
      mcqOptions: [
        'Partitioning the array around a pivot',
        'Counting key frequencies',
        'Merging two sorted lists',
        'Building a trie of the keys'
      ]
    },
    {
      name: 'heap sort',
      purpose: 'sorting by building a heap and repeatedly removing the root element',
      useCase: 'obtain in-place O(n log n) sorting without relying on random pivots',
      workload: 'sorting arrays when low extra space and predictable worst-case bounds are needed',
      altWorkload: 'maintaining stable relative order among equal keys',
      comparison: 'merge sort',
      commonOperation: 'build a heap and repeatedly restore heap order after root removal',
      pitfall: 'confusing max-heap and min-heap behaviour during extraction',
      testCase: 'reverse-sorted arrays and repeated root swaps',
      optimization: 'bottom-up heap construction before extraction begins',
      designGoal: 'sort in place while maintaining O(n log n) complexity',
      mcqStem: 'Which property is true of heap sort?',
      mcqOptions: [
        'It provides O(n log n) worst-case time with small auxiliary space',
        'It is always stable',
        'It requires a balanced binary search tree',
        'It works only on already sorted arrays'
      ]
    },
    {
      name: 'counting sort',
      purpose: 'sorting integer keys by counting how many times each key value occurs',
      useCase: 'sort data efficiently when keys come from a small bounded range',
      workload: 'sorting dense integer keys with many repetitions',
      altWorkload: 'sorting sparse keys over a very large numeric range',
      comparison: 'quicksort',
      commonOperation: 'count frequencies and reconstruct stable output',
      pitfall: 'forgetting stable placement during output reconstruction',
      testCase: 'duplicate keys and buckets with zero frequency',
      optimization: 'compressing or shifting the key range before counting',
      designGoal: 'exploit limited key range for near-linear sorting',
      mcqStem: 'When is counting sort most appropriate?',
      mcqOptions: [
        'When integer keys lie in a small bounded range',
        'When keys are arbitrary long strings',
        'When a stable comparison function is unavailable',
        'When the input is stored only as linked nodes'
      ]
    },
    {
      name: 'binary search',
      purpose: 'locating a target in ordered data by repeatedly halving the search interval',
      useCase: 'perform efficient exact-match lookup in a sorted collection',
      workload: 'running repeated exact-match queries over ordered data',
      altWorkload: 'searching unsorted data that changes frequently',
      comparison: 'linear search',
      commonOperation: 'halving the active search interval around a midpoint',
      pitfall: 'introducing off-by-one errors in mid calculation or loop bounds',
      testCase: 'target absent, first element, last element, and duplicate keys',
      optimization: 'maintaining loop invariants and overflow-safe mid computation',
      designGoal: 'reduce search cost from linear to logarithmic time',
      mcqStem: 'What prerequisite must hold before binary search can be applied correctly?',
      mcqOptions: [
        'The data must be sorted',
        'The data must be stored in a heap',
        'The data must contain distinct keys',
        'The data must fit in main memory'
      ]
    }
  ]
});

modules.push({
  moduleNumber: 5,
  topics: [
    {
      name: 'breadth-first search',
      purpose: 'exploring graph vertices level by level from a starting point',
      useCase: 'find unweighted shortest paths and discover graph layers',
      workload: 'solving graph problems where edge-count distance matters',
      altWorkload: 'exploring a path as deeply as possible before considering siblings',
      comparison: 'depth-first search',
      commonOperation: 'queue-based traversal with visited marking',
      pitfall: 'marking vertices too late and enqueuing duplicates unnecessarily',
      testCase: 'graphs with cycles and disconnected components',
      optimization: 'using adjacency lists and early visited marking',
      designGoal: 'preserve level order while computing edge-count distances',
      mcqStem: 'Which traversal is used to find shortest paths in an unweighted graph?',
      mcqOptions: ['Breadth-first search', 'Depth-first search', 'Quicksort', 'Counting sort']
    },
    {
      name: 'depth-first search',
      purpose: 'exploring graph vertices by going as deep as possible before backtracking',
      useCase: 'support cycle detection, connectivity analysis, and traversal timestamps',
      workload: 'analyzing graph structure through deep exploration',
      altWorkload: 'finding shortest paths in an unweighted graph',
      comparison: 'breadth-first search',
      commonOperation: 'recursive or stack-based traversal with backtracking',
      pitfall: 'failing to distinguish discovered, active, and finished states',
      testCase: 'back edges, disconnected components, and deep traversal chains',
      optimization: 'switching to an explicit stack for very deep graphs',
      designGoal: 'extract structural information from graph traversal order',
      mcqStem: 'Which traversal is naturally suited to detecting back edges during graph exploration?',
      mcqOptions: ['Depth-first search', 'Breadth-first search', 'Heap sort', 'Counting sort']
    },
    {
      name: 'Dijkstra algorithm',
      purpose: 'computing single-source shortest paths in graphs with non-negative edge weights',
      useCase: 'find efficient routes when every edge weight is non-negative',
      workload: 'solving weighted routing problems with positive path costs',
      altWorkload: 'processing graphs that contain negative-weight edges',
      comparison: 'Bellman-Ford algorithm',
      commonOperation: 'edge relaxation driven by a priority queue',
      pitfall: 'finalizing distances incorrectly or ignoring stale queue entries',
      testCase: 'graphs with unreachable vertices and multiple competing paths',
      optimization: 'choosing an efficient priority-queue strategy',
      designGoal: 'compute shortest paths efficiently for non-negative weighted graphs',
      mcqStem: 'What is the key restriction for applying Dijkstra algorithm correctly?',
      mcqOptions: [
        'All edge weights must be non-negative',
        'The graph must be acyclic',
        'The graph must be complete',
        'All vertices must have equal degree'
      ]
    },
    {
      name: 'Kruskal algorithm',
      purpose: 'constructing a minimum spanning tree by choosing edges in nondecreasing weight order',
      useCase: 'build a minimum-cost spanning structure in a weighted graph',
      workload: 'processing sparse weighted graphs where sorted edges are convenient',
      altWorkload: 'growing a spanning tree from a single source in a dense graph',
      comparison: 'Prim algorithm',
      commonOperation: 'sorted-edge selection with disjoint-set cycle checks',
      pitfall: 'adding an edge that forms a cycle because connectivity was checked incorrectly',
      testCase: 'equal-weight edges and disconnected graphs',
      optimization: 'integrating an efficient disjoint-set implementation',
      designGoal: 'construct a minimum spanning tree without creating cycles',
      mcqStem: 'Which auxiliary structure is commonly paired with Kruskal algorithm to detect cycles efficiently?',
      mcqOptions: ['Disjoint set union', 'Trie', 'Dynamic array', 'Recursion tree']
    },
    {
      name: 'topological sorting',
      purpose: 'ordering tasks in a directed acyclic graph according to precedence constraints',
      useCase: 'schedule tasks so that every prerequisite appears before dependent work',
      workload: 'processing dependency graphs with acyclic ordering constraints',
      altWorkload: 'handling graphs that may contain cycles or contradictory prerequisites',
      comparison: 'depth-first search finishing order',
      commonOperation: 'indegree reduction or DFS postorder extraction',
      pitfall: 'failing to detect a cycle before accepting an ordering as valid',
      testCase: 'multiple valid orders and a hidden cycle in the dependency graph',
      optimization: 'maintaining indegree counts efficiently during processing',
      designGoal: 'produce a dependency-respecting execution schedule',
      mcqStem: 'Topological sorting is defined only for which kind of graph?',
      mcqOptions: ['Directed acyclic graph', 'Undirected weighted graph', 'Complete graph', 'Binary tree']
    }
  ]
});

templates.push(
  {
    marks: 2,
    difficulty: 'L1',
    bloomsLevel: 'K1',
    questionType: 'MCQ',
    build: (topic) => `${topic.mcqStem} A) ${topic.mcqOptions[0]} B) ${topic.mcqOptions[1]} C) ${topic.mcqOptions[2]} D) ${topic.mcqOptions[3]}`
  },
  {
    marks: 2,
    difficulty: 'L1',
    bloomsLevel: 'K1',
    questionType: 'Theory',
    build: (topic) => `Define ${topic.name} and state its primary purpose in ${topic.purpose}.`
  },
  {
    marks: 2,
    difficulty: 'L1',
    bloomsLevel: 'K2',
    questionType: 'Theory',
    build: (topic) => `List two important characteristics of ${topic.name} that make it useful for ${topic.workload}.`
  },
  {
    marks: 2,
    difficulty: 'L1',
    bloomsLevel: 'K2',
    questionType: 'Theory',
    build: (topic) => `Mention one practical use case where ${topic.name} is preferred, and justify the choice briefly.`
  },
  {
    marks: 5,
    difficulty: 'L2',
    bloomsLevel: 'K2',
    questionType: 'Theory',
    build: (topic) => `Explain how ${topic.name} is applied to ${topic.useCase}.`
  },
  {
    marks: 2,
    difficulty: 'L1',
    bloomsLevel: 'K2',
    questionType: 'Theory',
    build: (topic) => `State why ${topic.name} is more suitable than ${topic.comparison} for ${topic.workload}.`
  },
  {
    marks: 5,
    difficulty: 'L2',
    bloomsLevel: 'K3',
    questionType: 'Theory',
    build: (topic) => `Trace the major steps of ${topic.commonOperation} in ${topic.name} using a small but clear example.`
  },
  {
    marks: 5,
    difficulty: 'L2',
    bloomsLevel: 'K3',
    questionType: 'Theory',
    build: (topic) => `Write structured steps or pseudocode for ${topic.commonOperation} using ${topic.name}.`
  },
  {
    marks: 5,
    difficulty: 'L2',
    bloomsLevel: 'K3',
    questionType: 'Theory',
    build: (topic) => `Compare ${topic.name} with ${topic.comparison} for the workload of ${topic.workload}.`
  },
  {
    marks: 5,
    difficulty: 'L2',
    bloomsLevel: 'K4',
    questionType: 'Theory',
    build: (topic) => `Analyze the time and space complexity of ${topic.commonOperation} in ${topic.name}, and identify the dominant cost.`
  },
  {
    marks: 5,
    difficulty: 'L2',
    bloomsLevel: 'K4',
    questionType: 'Theory',
    build: (topic) => `Analyze how ${topic.pitfall} can affect the correctness or efficiency of ${topic.name}.`
  },
  {
    marks: 5,
    difficulty: 'L2',
    bloomsLevel: 'K4',
    questionType: 'Theory',
    build: (topic) => `Discuss the boundary conditions that must be tested when implementing ${topic.name}, especially for ${topic.testCase}.`
  },
  {
    marks: 10,
    difficulty: 'L3',
    bloomsLevel: 'K5',
    questionType: 'Theory',
    build: (topic) => `Evaluate whether ${topic.name} is a better choice than ${topic.comparison} for ${topic.workload}, and justify your recommendation.`
  },
  {
    marks: 10,
    difficulty: 'L3',
    bloomsLevel: 'K5',
    questionType: 'Theory',
    build: (topic) => `Design a procedure or workflow that uses ${topic.name} to ${topic.designGoal}.`
  },
  {
    marks: 10,
    difficulty: 'L3',
    bloomsLevel: 'K5',
    questionType: 'Theory',
    build: (topic) => `Propose optimizations for ${topic.name} with respect to ${topic.optimization}, and discuss the trade-offs involved.`
  },
  {
    marks: 10,
    difficulty: 'L3',
    bloomsLevel: 'K5',
    questionType: 'Theory',
    build: (topic) => `Develop a validation strategy to test an implementation of ${topic.name} against ${topic.testCase}.`
  },
  {
    marks: 10,
    difficulty: 'L3',
    bloomsLevel: 'K6',
    questionType: 'Theory',
    build: (topic) => `Evaluate how the suitability of ${topic.name} changes when the workload shifts from ${topic.workload} to ${topic.altWorkload}.`
  },
  {
    marks: 10,
    difficulty: 'L3',
    bloomsLevel: 'K6',
    questionType: 'Theory',
    build: (topic) => `A student implemented ${topic.name} but ignored ${topic.pitfall}. Critique the design and explain the likely consequences.`
  },
  {
    marks: 10,
    difficulty: 'L3',
    bloomsLevel: 'K6',
    questionType: 'Theory',
    build: (topic) => `Your system currently uses ${topic.comparison}. Recommend whether it should migrate to ${topic.name} for ${topic.workload}, with reasons.`
  },
  {
    marks: 10,
    difficulty: 'L3',
    bloomsLevel: 'K6',
    questionType: 'Theory',
    build: (topic) => `Create a complete exam-style note on ${topic.name} covering definition, working principle, complexity, applications, limitations, and one appropriate example.`
  }
);

function escapeCsv(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildRows() {
  const rows = [];

  modules.forEach((module) => {
    module.topics.forEach((topic) => {
      templates.forEach((template) => {
        rows.push({
          QuestionText: template.build(topic),
          SubjectCode: SUBJECT_CODE,
          ModuleNumber: module.moduleNumber,
          Marks: template.marks,
          Difficulty: template.difficulty,
          BloomsLevel: template.bloomsLevel,
          QuestionType: template.questionType
        });
      });
    });
  });

  return rows;
}

function writeCsv(rows) {
  const headers = ['QuestionText', 'SubjectCode', 'ModuleNumber', 'Marks', 'Difficulty', 'BloomsLevel', 'QuestionType'];
  const content = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(','))
  ].join('\n');

  fs.mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, content);
}

const rows = buildRows();

if (rows.length !== 500) {
  throw new Error(`Expected 500 questions but generated ${rows.length}.`);
}

writeCsv(rows);
console.log(`Generated ${rows.length} sample questions at ${OUTPUT_PATH}`);
