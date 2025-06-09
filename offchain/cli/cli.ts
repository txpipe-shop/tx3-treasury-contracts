#!/usr/bin/env node

import { Command } from "commander";
import { publish } from "./treasury/publish";
import { fund } from "./treasury/fund";
import { withdraw as initialize } from "./treasury/withdraw";

const program = new Command();

program
  .name("treasury-funds")
  .description("Treasury funds CLI tool")
  .version("1.0.0");

program
  .command("publish")
  .description("Initiate/publish treasury and vendor contracts")
  .action(async () => {
    await publish();
  });

program
  .command("initialize")
  .description("Initialize treasury by withdrawing funds")
  .action(async () => {
    await initialize();
  });

program
  .command("fund")
  .description("Fund a vendor utxo from the treasury")
  .action(async () => {
    await fund();
  });

program.parse(process.argv);
