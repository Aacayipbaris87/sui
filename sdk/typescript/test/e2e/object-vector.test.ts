// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach } from 'vitest';
import {
  Coin,
  Commands,
  getCreatedObjects,
  getExecutionStatusType,
  ObjectId,
  SUI_FRAMEWORK_ADDRESS,
  Transaction,
} from '../../src';
import {
  DEFAULT_GAS_BUDGET,
  publishPackage,
  setup,
  TestToolbox,
} from './utils/setup';

describe('Test Move call with a vector of objects as input (skipped due to move vector requirement)', () => {
  let toolbox: TestToolbox;
  let packageId: ObjectId;

  async function mintObject(val: number) {
    const tx = new Transaction();
    tx.setGasBudget(DEFAULT_GAS_BUDGET);
    tx.add(
      Commands.MoveCall({
        target: `${packageId}::entry_point_vector::mint`,
        arguments: [tx.input(String(val))],
      }),
    );
    const result = await toolbox.signer.signAndExecuteTransaction(tx);
    expect(getExecutionStatusType(result)).toEqual('success');
    return getCreatedObjects(result)![0].reference.objectId;
  }

  async function destroyObjects(objects: ObjectId[]) {
    const tx = new Transaction();
    tx.setGasBudget(DEFAULT_GAS_BUDGET);
    const vec = tx.add(
      Commands.MakeMoveVec({ objects: objects.map((id) => tx.input(id)) }),
    );
    tx.add(
      Commands.MoveCall({
        target: `${packageId}::entry_point_vector::two_obj_vec_destroy`,
        arguments: [vec],
      }),
    );
    const result = await toolbox.signer.signAndExecuteTransaction(tx);
    expect(getExecutionStatusType(result)).toEqual('success');
  }

  beforeEach(async () => {
    toolbox = await setup();
    const packagePath =
      __dirname +
      '/../../../../crates/sui-core/src/unit_tests/data/entry_point_vector';
    packageId = await publishPackage(packagePath);
  });

  it('Test object vector', async () => {
    await destroyObjects([await mintObject(7), await mintObject(42)]);
  });

  it('Test regular arg mixed with object vector arg', async () => {
    const coins = await toolbox.getGasObjectsOwnedByAddress();
    const coinIDs = coins.map((coin) => Coin.getID(coin));
    const tx = new Transaction();
    tx.setGasBudget(DEFAULT_GAS_BUDGET);
    const vec = tx.add(
      Commands.MakeMoveVec({
        objects: [tx.input(coinIDs[1]), tx.input(coinIDs[2])],
      }),
    );
    tx.add(
      Commands.MoveCall({
        target: `${SUI_FRAMEWORK_ADDRESS}::pay::join_vec`,
        typeArguments: ['0x2::sui::SUI'],
        arguments: [tx.input(coinIDs[0]), vec],
      }),
    );
    tx.setGasPayment([coins[3]]);
    const result = await toolbox.signer.signAndExecuteTransaction(tx);
    expect(getExecutionStatusType(result)).toEqual('success');
  });
});
