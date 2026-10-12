import { planClass } from "@/server/classes";
import { prisma } from "@/server/db";
import { body, route } from "@/server/http";
import { classSchema } from "@/server/validators";

export const POST = route(async (req) => planClass(prisma, await body(req, classSchema)));
