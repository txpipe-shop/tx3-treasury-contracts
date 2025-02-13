# treasury-funds

These contracts provide a simple but robust way to manage funds withdrawn from the treasury.

They ensure that the funds cannot be delegated, and cannot be used in governance voting.

Additionally, the require approval from a set of independent "auditors" for any disbursments,
with the intention that requests for disbursement include a durable link to off-chain invoices
and proof of work completion.

Disbursals require a high threshold of consent (ex: unanimous) from the auditors.
However, to minimize the impact of a lost key, funds can be withdrawn with a lower
threshold requirement after a long timeout.

After a longer timeout, or with unanimous consent of the auditors, the funds can be
sent back to the treasury.

The contract can optionally support an initial OTC deal, where the initially withdrawn funds
can be swapped for a stablecoin at an agreed upon price.
