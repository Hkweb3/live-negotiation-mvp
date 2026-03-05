import { appConfig } from "../config";
import { AuthRepository, CaseRepository } from "../repositories/interfaces";
import { InMemoryAuthRepository } from "../repositories/memoryAuthRepository";
import { InMemoryCaseRepository } from "../repositories/memoryCaseRepository";
import { getPrismaClient } from "../repositories/prismaClient";
import { PrismaAuthRepository } from "../repositories/prismaAuthRepository";
import { PrismaCaseRepository } from "../repositories/prismaCaseRepository";
import { AuthService } from "../services/authService";
import { CopilotService } from "../services/copilotService";
import {
  HeuristicNegotiationEngine,
  OpenAINegotiationEngine,
  NegotiationEngine
} from "../services/negotiationEngine";

export interface AppContainer {
  readonly authService: AuthService;
  readonly copilotService: CopilotService;
  readonly negotiationEngine: NegotiationEngine;
  readonly persistenceMode: "memory" | "postgres";
  readonly aiMode: "heuristic" | "openai";
  close(): Promise<void>;
}

export function createContainer(): AppContainer {
  let authRepository: AuthRepository;
  let caseRepository: CaseRepository;
  let persistenceMode: "memory" | "postgres";

  if (appConfig.databaseUrl) {
    const prisma = getPrismaClient();
    authRepository = new PrismaAuthRepository(prisma);
    caseRepository = new PrismaCaseRepository(prisma);
    persistenceMode = "postgres";
  } else {
    authRepository = new InMemoryAuthRepository();
    caseRepository = new InMemoryCaseRepository();
    persistenceMode = "memory";
  }

  const negotiationEngine = appConfig.openAiApiKey
    ? new OpenAINegotiationEngine()
    : new HeuristicNegotiationEngine();

  const authService = new AuthService(authRepository);
  const copilotService = new CopilotService(caseRepository, negotiationEngine);

  return {
    authService,
    copilotService,
    negotiationEngine,
    persistenceMode,
    aiMode: appConfig.openAiApiKey ? "openai" : "heuristic",
    async close() {
      if (persistenceMode === "postgres") {
        const prisma = getPrismaClient();
        await prisma.$disconnect();
      }
    }
  };
}
