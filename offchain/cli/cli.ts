#!/usr/bin/env node

import { Command } from 'commander';
import { initiate } from './initiate';
import { withdraw } from './treasury/withdraw';

const program = new Command();

program
    .name('treasury-funds')
    .description('Treasury funds CLI tool')
    .version('1.0.0');

program
    .command('initiate')
    .description('Initiate treasury and vendor contracts')
    .action(async () => {
        await initiate()
    });

program
    .command('treasury-withdraw')
    .description('Withdraw funds to the treasury')
    .action(async () => {
        await withdraw();
    });

program.parse(process.argv);