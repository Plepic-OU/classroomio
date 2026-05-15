# Docker vs. Kubernetes

When you run `devcontainer up` on this repo, you end up with a Docker container that spawns more Docker containers
inside it — Postgres, GoTrue, Storage, Studio, Inbucket, Realtime, Edge Runtime, Redis. Eight or nine processes, each
isolated, each on its own port, all talking to each other on an internal network. That looks a lot like a cluster.
Is this already Kubernetes-shaped? And if not, why not — and can you build something Kubernetes-shaped using nothing
but Docker?

This document answers those questions. It assumes you have read
[containerization.md](./containerization.md) and understand what an image and a container are.

---

## What is actually running right now

Inside the devcontainer, two things spawn containers:

1. **The Supabase CLI**, which under the hood writes a `docker-compose.yml`-equivalent definition and asks the
   Docker-in-Docker daemon to start every service in it. The result is roughly:

   | Container               | Role                                  |
      |-------------------------|---------------------------------------|
   | `supabase_db`           | Postgres 15 with extensions           |
   | `supabase_auth`         | GoTrue (auth server)                  |
   | `supabase_rest`         | PostgREST (auto-generated REST API)   |
   | `supabase_storage`      | File storage service                  |
   | `supabase_realtime`     | WebSocket fanout for DB changes       |
   | `supabase_studio`       | Web UI on :54323                      |
   | `supabase_inbucket`     | Fake SMTP/inbox for email testing     |
   | `supabase_edge_runtime` | Deno runtime for Edge Functions       |
   | `supabase_kong`         | API gateway in front of all the above |

2. **`docker run -d --name classroomio-redis ...`** from `setup.sh`, which adds one more container alongside.

All of them share a Docker network the daemon created for the Supabase stack. They reach each other by container name
(`supabase_db`, `supabase_kong`, etc.) — Docker's built-in DNS resolves those names to internal IPs.

So yes: many isolated processes, internal networking, one shared lifecycle. That is the surface-level shape of a
cluster. But the resemblance is mostly cosmetic, and the differences matter once you leave a developer laptop.

---

## What Docker on its own gives you

Plain Docker — the daemon, the `docker` CLI, the image format — provides four primitives:

- **Containers** — isolated processes with their own filesystem, network, and PID namespace.
- **Images** — immutable layered filesystems that containers boot from.
- **Networks** — virtual L2 bridges that let containers talk to each other and resolve each other by name.
- **Volumes** — managed storage that outlives any individual container.

That is enough to run one app. It is not enough to orchestrate ten of them by hand. Two tools were built on top of
Docker to close that gap:

### Docker Compose

A YAML file describes every container you want, the network they share, the volumes they mount, the environment
variables they get, and the order they start in. One command — `docker compose up` — brings the whole thing up; one
command tears it down. Compose is what Supabase uses internally; it is what almost every "spin up a multi-service dev
environment" tutorial uses.

Compose handles a real but bounded slice of orchestration: dependency order, restart-on-crash, log aggregation, named
networks, named volumes, environment injection. It does this on **one host**. There is no scheduler making decisions
about where containers should run, because there is only one place they can run.

### Docker Swarm

Docker's own attempt at multi-host orchestration. You join several machines into a swarm; you submit a "stack" (a
Compose file with a few extra fields); Swarm decides which machine runs which container, restarts failed ones,
provides a built-in load balancer, and rolls out updates. It is a real cluster manager.

Swarm is also effectively in maintenance mode. Docker, Inc. still ships it, but the wider ecosystem moved to
Kubernetes years ago, so tooling, hosted offerings, and community knowledge for Swarm are thin. New projects almost
never pick it.

---

## What Kubernetes adds on top

Kubernetes is not "Docker with more YAML." It is a different category of system. The core idea is **declarative state
reconciliation**: you describe the world you want (5 replicas of this service, exposed on this hostname, talking to
this database), and a control loop constantly compares that to the world that exists and fixes the difference.

Concretely, that gives you:

- **Multi-node scheduling.** A scheduler decides which physical (or virtual) machine each container runs on, based on
  CPU/memory requests, anti-affinity rules ("don't put both replicas of the database on the same machine"), node
  labels ("only GPU nodes"), and current load. When a node dies, the scheduler reassigns its workloads to other
  nodes.
- **Self-healing.** A crashed container is restarted. A crashed node has its workloads rescheduled. A failed
  deployment is automatically rolled back. None of this requires human intervention.
- **Service discovery and load balancing.** Every "Service" gets a stable virtual IP and DNS name. Traffic is
  load-balanced across all healthy replicas. When pods come and go, the load balancer updates itself.
- **Rolling updates with health gates.** A new version comes up alongside the old one, traffic shifts gradually, and
  the rollout halts automatically if health checks regress.
- **Horizontal autoscaling.** Replica counts can scale up and down based on CPU, memory, or custom metrics.
- **Secrets and config separation.** Configuration and secrets are first-class resources, mounted into pods as files
  or environment variables, rotatable without rebuilding images.
- **Persistent volume abstraction.** Storage is requested by spec (`10Gi, ReadWriteOnce`), and the cluster binds it
  to whatever backend is available — EBS, GCE PD, Ceph, NFS — without the app caring.
- **Namespaces, RBAC, network policies.** Multi-tenancy primitives. You can carve one cluster into isolated
  environments with separate quotas and access rules.
- **Operators.** A pattern for encoding the operational knowledge of running a stateful system (Postgres replication,
  Kafka rebalancing, certificate rotation) as code that runs *inside* the cluster and reconciles its own custom
  resources.

None of these are features of Docker the container runtime. They are features of a cluster manager that happens to
use a container runtime underneath. (And in 2026 that runtime is usually containerd or CRI-O, not Docker — Kubernetes
dropped direct Docker support in v1.24.)

---

## So is the current setup "like a Kubernetes cluster"?

No, not in any load-bearing sense. It is **Docker Compose-style orchestration on a single host**, which happens to be
itself a container. The resemblance is "many containers running together with shared networking." That is also true
of every laptop running `docker compose up`.

What is missing, compared to a real cluster:

- There is one node. Nothing schedules across machines because there are no other machines.
- Nothing reconciles desired state. If `supabase_db` crashes, Docker's restart policy may bring it back, but nothing
  notices if the *config* drifts from what was declared.
- There is no service abstraction with a stable virtual IP — containers talk to each other by container name on a
  user-defined bridge network, which works only inside that network on that host.
- There is no rolling update, no canary, no autoscaling, no health-gated rollout.
- There is no separation between "what should be running" (declarative spec) and "what is running" (actual state).
  The Supabase CLI writes a Compose file, runs it, and forgets about it. Nothing watches.

The setup is fit for purpose — a one-developer reproducible dev environment — and a cluster manager would be wasted
effort here. But it is not a cluster.

---

## Can you build a Kubernetes-equivalent with pure Docker?

Three honest answers depending on what you mean.

### "Multi-service app on one machine, started and stopped together"

Yes, completely. **Docker Compose** is the right tool and it is part of the Docker ecosystem. You get dependency
ordering, named networks, volumes, restart-on-crash, environment management, and a single command to bring everything
up or down. For local development, internal tools, small self-hosted deployments, and a surprising amount of
production traffic, this is sufficient.

This is what `supabase start` is already doing, and what self-hosted ClassroomIO production deployments typically
use — a single host running `docker compose up -d`, fronted by a reverse proxy for TLS.

### "Multi-host cluster with scheduling, failover, and rolling updates"

Yes, technically, with **Docker Swarm**. You initialize a swarm, join worker nodes, deploy a stack, and Swarm
handles placement, restarts, and basic rolling updates. The Compose file format mostly carries over.

The catch is that almost nobody picks Swarm for a new project in 2026. The ecosystem of operators, hosted control
planes, monitoring integrations, and accumulated operational knowledge is overwhelmingly on the Kubernetes side. You
*can* run Swarm; you will be lonely.

### "The full set of features Kubernetes has — declarative reconciliation, operators, autoscaling, network policies, the whole stack"

No, not without rebuilding Kubernetes. Those features are not in Docker, are not in Compose, and are not in Swarm.
You could in principle write your own control loops on top of the Docker API — watch a desired-state file, diff it
against `docker ps`, take action. People have done this in small scopes. Doing it well, across multiple hosts, with
the reliability guarantees Kubernetes provides, *is* writing Kubernetes. The reason Kubernetes exists is that this
turns out to be a lot of work.

The shortest path to "I want a Kubernetes-shaped thing without committing to managing one" is a **managed Kubernetes
service** (GKE, EKS, AKS, DigitalOcean Kubernetes, Fly Machines as a lighter alternative, etc.). The control plane is
operated for you; you bring workloads.

---

## When does this distinction actually matter?

For ClassroomIO specifically, here is a rough decision frame:

| Scenario                                           | What fits                                    |
|----------------------------------------------------|----------------------------------------------|
| Local dev for a contributor                        | The devcontainer + Supabase CLI (what we do) |
| Self-hosted by a single school or small org        | Docker Compose on one VM                     |
| Multi-tenant cloud, single region, moderate scale  | Managed Kubernetes or a PaaS (Fly, Render)   |
| Multi-region, HA, strict isolation between tenants | Kubernetes, probably with operators          |

The category boundary is roughly: as soon as "the host died and the service must come back up somewhere else within
60 seconds" becomes a requirement, you need something that schedules across machines. Until then, Docker (with
Compose) is usually the simpler answer, and "simpler" has its own large value.

---

## TL;DR

- **Docker** is a container runtime. It runs one container well.
- **Docker Compose** orchestrates many containers on **one host**. It is what the current setup actually uses,
  transitively through `supabase start`.
- **Docker Swarm** orchestrates many containers across **many hosts**, but is effectively legacy.
- **Kubernetes** is a different category of system: declarative state reconciliation, scheduling, self-healing,
  service discovery, autoscaling, the works. It uses *a* container runtime underneath; that runtime is no longer
  Docker by default.
- The current ClassroomIO dev environment is multi-container, but it is not a cluster. It is Compose nested inside
  one Docker host, which is fine — clusters cost what they cost, and a laptop does not need one.
