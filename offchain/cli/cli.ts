#!/usr/bin/env node

import { Command } from "commander";
import { initiate } from "./initiate";
import { withdraw } from "./treasury/withdraw";

const program = new Command();

program
  .name("treasury-funds")
  .description("Treasury funds CLI tool")
  .version("1.0.0");

program
  .command("publish")
  .description("Initiate/publish treasury and vendor contracts")
  .action(async () => {
    await initiate();
  });

program
  .command("initialize")
  .description("Initialize treasury by withdrawing funds")
  .action(async () => {
    await withdraw();
  });

program.parse(process.argv);
