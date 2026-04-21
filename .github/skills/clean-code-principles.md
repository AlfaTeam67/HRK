---
name: clean-code-principles
description: Universal software engineering principles that apply to ALL coding tasks in any language (Python, TypeScript, JavaScript, Go, Java, etc.). Enforces SOLID/SRP, DRY, KISS, YAGNI, Scout's Rule, DRTW (Don't Reinvent The Wheel), clean naming, and no inline imports. Apply these principles proactively whenever writing new code, modifying existing code, reviewing code, or refactoring — even when the user doesn't explicitly ask for code quality guidance.
---

# Clean Code Principles

These principles exist for one reason: code is written once but read and maintained many times. Every principle here reduces the cost of that future work.

Apply these at all times across all languages. They are not checklists — internalize the reasoning and use judgment.

---

## 1. SOLID — Single Responsibility Principle (SRP) is paramount

A class, function, or module should do one thing and do it well. When something changes, only one reason should cause it to change.

**Why it matters:** Functions that do many things are harder to name, test, and reuse. They accumulate bugs because every change risks breaking unrelated behavior.

```python
# BAD: one function handles both business logic and persistence
def process_and_save_order(order_data):
    total = sum(item['price'] for item in order_data['items'])
    order_data['total'] = total
    db.save(order_data)

# GOOD: each function has one job
def calculate_order_total(items):
    return sum(item['price'] for item in items)

def save_order(order):
    db.save(order)
```

Ask: "If I describe this function in one sentence, does it use the word 'and'?" If yes, split it.

---

## 2. DRY — Don't Repeat Yourself

Before writing new code, check if the logic already exists. If a function does something similar but not identical, prefer adapting that function over creating a near-duplicate.

**Why it matters:** Duplicate code is a maintenance trap. Bug fixes, behavior changes, and tests need to be applied in multiple places — and one will always be missed.

When adapting an existing function: add an optional parameter, extract a shared helper, or refactor the shared logic into a base. Only create something new when the functions are genuinely unrelated.

```typescript
// BAD: two nearly-identical fetch functions
async function fetchActiveUsers() {
  return db.query('SELECT * FROM users WHERE status = "active"')
}
async function fetchInactiveUsers() {
  return db.query('SELECT * FROM users WHERE status = "inactive"')
}

// GOOD: one function, parameterized
async function fetchUsersByStatus(status: string) {
  return db.query('SELECT * FROM users WHERE status = ?', [status])
}
```

---

## 3. KISS — Keep It Simple, Stupid

The best solution is the simplest one that correctly solves the problem. Ten well-planned lines beat a hundred tangled ones. Clever code that requires careful study to understand is a liability.

**Why it matters:** Simple code is easier to debug, review, and hand off. Complexity accumulates — every unnecessary abstraction is debt that compounds.

Prefer:
- Early returns over nested conditionals
- Built-in language features over hand-rolled equivalents
- Flat structure over deep hierarchies
- Explicit over implicit

```python
# BAD: unnecessary complexity
def get_discount(user):
    if user is not None:
        if user.membership is not None:
            if user.membership.tier == 'premium':
                return 0.2
            else:
                return 0.0
        else:
            return 0.0
    else:
        return 0.0

# GOOD: flat and readable
def get_discount(user):
    if user and user.membership and user.membership.tier == 'premium':
        return 0.2
    return 0.0
```

---

## 4. No Imports Inside Functions

Imports belong at the top of the file. Never import a module or file inside a function body.

**Why it matters:** Inline imports hide dependencies, make the file's requirements non-obvious, and can cause subtle performance issues (repeated module lookups). Code reviewers and linters expect imports at the top.

```python
# BAD
def process_image(path):
    import PIL  # hidden dependency
    return PIL.Image.open(path)

# GOOD
import PIL

def process_image(path):
    return PIL.Image.open(path)
```

This applies equally to Python, JavaScript, TypeScript, and any other language with import/require semantics.

---

## 5. DRTW — Don't Reinvent The Wheel

Before writing utility code, check whether the language's standard library or an already-installed dependency solves it. A built-in `.filter()`, `.map()`, `sorted()`, `groupBy()`, or date formatter is better than a hand-rolled version.

**Why it matters:** Custom implementations introduce bugs, require tests, and must be maintained. Battle-tested library code has already absorbed those costs.

```typescript
// BAD: custom implementation of something the language already does
function filterActiveItems(items) {
  const result = []
  for (let i = 0; i < items.length; i++) {
    if (items[i].active === true) {
      result.push(items[i])
    }
  }
  return result
}

// GOOD: use what's already there
const activeItems = items.filter(item => item.active)
```

If a new library is genuinely needed, choose one — don't write the solution from scratch.

---

## 6. Meaningful Naming

Names should reveal intent. Reading a function call or variable name should tell you what it does or holds — without reading its implementation.

**Why it matters:** Good names reduce the cognitive load on every future reader (including you, six months from now). Poor names force people to trace through implementations to understand simple things.

Rules:
- Functions: verb + noun (`calculateTotal`, `fetchUserById`, `isEmailValid`)
- Booleans: question form (`isActive`, `hasPermission`, `canEdit`)
- Avoid single letters except in short loops (`i`, `j`) and well-known math contexts
- Avoid generic names like `data`, `info`, `temp`, `result`, `obj` unless scope is tiny

```typescript
// BAD
const d = new Date()
const arr = users.filter(u => u.a)
function proc(x) { ... }

// GOOD
const currentDate = new Date()
const activeUsers = users.filter(user => user.isActive)
function processPaymentRefund(transaction) { ... }
```

---

## 7. YAGNI — You Aren't Gonna Need It

Build exactly what is required right now. Do not add hooks, abstractions, or flexibility for features that might be needed someday.

**Exception:** If the user explicitly states a future requirement in the current task (e.g., "this will later support multiple currencies"), it's reasonable to design with that in mind — but only structure for it, don't implement it.

**Why it matters:** Speculative features add complexity, require tests, and are often wrong about what the future actually needs. The simplest correct implementation is the right one to ship.

```python
# BAD: abstracting for imaginary future use cases
class DataProcessor:
    def __init__(self, strategy=None, formatter=None, validator=None, pipeline=None):
        # ...

# GOOD: solve the actual problem
class DataProcessor:
    def process(self, data):
        # ...
```

---

## 8. Scout's Rule — Leave the Code Cleaner Than You Found It

When you change a file, clean up what you touched. If you abandon an approach mid-way and switch to a different solution, remove all traces of the old approach before moving on.

**Why it matters:** Abandoned code fragments (commented-out blocks, unused variables, leftover partial implementations) create confusion and noise. Reviewers can't tell if they're intentional or accidental. Over time they become permanent fixtures.

Before finishing work in a file:
- Remove commented-out code you're no longer using
- Delete unused variables and imports introduced during the session
- Ensure the file tells one coherent story

This is not about refactoring everything you see — it's about not leaving new mess behind.

---

## 9. N+1 Query Detection (Backend Code — All Languages)

Whenever writing or reviewing backend code that touches a database, actively check for N+1 query patterns. An N+1 happens when you fetch a list of N records and then execute one additional query per record — N+1 total instead of 1 or 2.

**Why it matters:** N+1 is one of the most common and silent performance killers. It passes unnoticed in dev with 10 records, then destroys production with 10,000.

**The universal pattern to spot:** a loop (or anything that iterates) that contains a DB call or accesses a lazily-loaded relationship.

---

### Django (ORM)

```python
# BAD: one query per order to get user
orders = Order.objects.all()
for order in orders:
    print(order.user.name)  # new query each iteration

# GOOD
orders = Order.objects.select_related('user').all()

# BAD: reverse FK / M2M in a loop
for order in orders:
    tags = order.tags.all()  # new query per order

# GOOD
orders = Order.objects.prefetch_related('tags').all()
```

Watch for: DRF serializers with `SerializerMethodField` hitting DB, nested serializers without prefetch on the parent queryset.

---

### SQLAlchemy (FastAPI, Flask, etc.)

```python
# BAD: lazy-loaded relationship accessed in loop
orders = session.query(Order).all()
for order in orders:
    print(order.user.name)  # triggers SELECT per iteration

# GOOD: eager load with joinedload
from sqlalchemy.orm import joinedload

orders = session.query(Order).options(joinedload(Order.user)).all()

# For collections (one-to-many / many-to-many): use subqueryload or selectinload
from sqlalchemy.orm import selectinload

orders = session.query(Order).options(selectinload(Order.tags)).all()
```

Watch for: relationships defined with `lazy='select'` (the default) accessed inside loops or list endpoints.

---

### Java — JPA / Hibernate

```java
// BAD: LAZY fetch accessed in loop — triggers query per entity
List<Order> orders = orderRepository.findAll();
for (Order order : orders) {
    System.out.println(order.getUser().getName()); // N queries
}

// GOOD: JPQL with JOIN FETCH
@Query("SELECT o FROM Order o JOIN FETCH o.user")
List<Order> findAllWithUser();

// GOOD: @EntityGraph on repository method
@EntityGraph(attributePaths = {"user", "tags"})
List<Order> findAll();
```

Watch for: `@OneToMany` / `@ManyToOne` with `FetchType.LAZY` accessed outside the original transaction.

---

### TypeORM (Node.js / TypeScript)

```typescript
// BAD: relations not loaded, accessed in loop
const orders = await orderRepository.find()
for (const order of orders) {
  console.log(order.user.name) // undefined or extra query
}

// GOOD: eager load with relations option
const orders = await orderRepository.find({ relations: ['user', 'tags'] })

// GOOD: QueryBuilder with leftJoinAndSelect
const orders = await orderRepository
  .createQueryBuilder('order')
  .leftJoinAndSelect('order.user', 'user')
  .getMany()
```

---

### Prisma (Node.js / TypeScript)

```typescript
// BAD
const orders = await prisma.order.findMany()
for (const order of orders) {
  const user = await prisma.user.findUnique({ where: { id: order.userId } })
}

// GOOD
const orders = await prisma.order.findMany({
  include: { user: true, tags: true }
})
```

---

### Raw SQL (any language)

```sql
-- BAD pattern (in application code): SELECT per row
SELECT * FROM orders;
-- then for each order: SELECT * FROM users WHERE id = ?

-- GOOD: single JOIN
SELECT orders.*, users.name
FROM orders
JOIN users ON orders.user_id = users.id;
```

---

**Universal checklist for any list endpoint:**
- Is there a loop that makes a DB call or accesses a relationship? -> red flag
- Are all needed relations loaded upfront in a single query?
- Does the ORM use lazy loading by default for this relationship?

---

## Quick Self-Check Before Finishing Any Code Task

- Does each function do one thing? (SRP)
- Is there existing code that already does something similar? (DRY)
- Is this the simplest correct solution? (KISS)
- Are all imports at the top of the file?
- Did I use built-in tools instead of rolling my own? (DRTW)
- Are names descriptive enough to understand without reading the body?
- Did I add only what was asked for? (YAGNI)
- Is the file cleaner than when I started? (Scout's Rule)
- Can newly created code have a potential N+1 problem?
