/*
 * SIPEVITA Chaincode - Sistem Pencatatan dan Verifikasi Kepemilikan Tanah
 * Blockchain-based Land Ownership Recording and Verification System
 * 
 * Copyright IBM Corp. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const stringify = require('json-stringify-deterministic');
const sortKeysRecursive = require('sort-keys-recursive');
const { Contract } = require('fabric-contract-api');

class SIPEVITAContract extends Contract {

    /**
     * InitLedger initializes the ledger with sample land records
     */
    async InitLedger(ctx) {
        const landAssets = [
            {
                nomor_sertifikat: 'SHM-INIT-001',
                hash_pemilik: 'hash_pemilik_init_001',
                hash_dokumen: 'hash_dokumen_init_001',
                luas_tanah: '100',
                lokasi_hash: 'lokasi_hash_init_001',
                cid_ipfs: 'ipfs://cid_init_001',
                status: 'ACTIVE',
                created_at: this._getTxTimestamp(ctx),
                updated_at: this._getTxTimestamp(ctx),
            },
        ];

        for (const landAsset of landAssets) {
            await ctx.stub.putState(
                landAsset.nomor_sertifikat,
                Buffer.from(stringify(sortKeysRecursive(landAsset)))
            );
        }
    }

    /**
     * recordLand creates a new land ownership record
     * @param ctx - transaction context
     * @param nomor_sertifikat - certificate number (unique key)
     * @param hash_pemilik - hash of owner identity
     * @param hash_dokumen - hash of supporting documents
     * @param luas_tanah - land area
     * @param lokasi_hash - hash of location data
     * @param cid_ipfs - IPFS Content ID for document storage
     */
    async recordLand(ctx, nomor_sertifikat, hash_pemilik, hash_dokumen, luas_tanah, lokasi_hash, cid_ipfs) {
        // Validate all mandatory fields are provided
        const requiredFields = {
            nomor_sertifikat,
            hash_pemilik,
            hash_dokumen,
            luas_tanah,
            lokasi_hash,
            cid_ipfs,
        };

        for (const [field, value] of Object.entries(requiredFields)) {
            if (!value || value.trim() === '') {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        // Check if land asset already exists
        const exists = await this._landAssetExists(ctx, nomor_sertifikat);
        if (exists) {
            throw new Error(`Land asset ${nomor_sertifikat} already exists`);
        }

        // Create new LandAsset
        const landAsset = {
            nomor_sertifikat,
            hash_pemilik,
            hash_dokumen,
            luas_tanah,
            lokasi_hash,
            cid_ipfs,
            status: 'ACTIVE',
            created_at: this._getTxTimestamp(ctx),
            updated_at: this._getTxTimestamp(ctx),
        };

        // Store in ledger with deterministic JSON serialization
        await ctx.stub.putState(
            nomor_sertifikat,
            Buffer.from(stringify(sortKeysRecursive(landAsset)))
        );

        return JSON.stringify(landAsset);
    }

    /**
     * verifyLand returns public verification data for a land asset
     * @param ctx - transaction context
     * @param nomor_sertifikat - certificate number
     */
    async verifyLand(ctx, nomor_sertifikat) {
        const landAssetJSON = await ctx.stub.getState(nomor_sertifikat);

        if (!landAssetJSON || landAssetJSON.length === 0) {
            return JSON.stringify({
                nomor_sertifikat,
                status: 'NOT_FOUND',
            });
        }

        const landAsset = JSON.parse(landAssetJSON.toString());

        // Return only public verification data (no owner hash)
        const verificationData = {
            nomor_sertifikat: landAsset.nomor_sertifikat,
            hash_dokumen: landAsset.hash_dokumen,
            cid_ipfs: landAsset.cid_ipfs,
            status: landAsset.status,
            updated_at: landAsset.updated_at,
        };

        return JSON.stringify(verificationData);
    }

    /**
     * validateHash verifies if submitted document hash matches stored hash
     * @param ctx - transaction context
     * @param nomor_sertifikat - certificate number
     * @param hash_dokumen - submitted document hash to verify
     */
    async validateHash(ctx, nomor_sertifikat, hash_dokumen) {
        const landAssetJSON = await ctx.stub.getState(nomor_sertifikat);

        if (!landAssetJSON || landAssetJSON.length === 0) {
            return JSON.stringify({
                nomor_sertifikat,
                valid: false,
                error: 'NOT_FOUND',
            });
        }

        const landAsset = JSON.parse(landAssetJSON.toString());
        const storedHash = landAsset.hash_dokumen;
        const isValid = storedHash === hash_dokumen;

        const result = {
            nomor_sertifikat,
            valid: isValid,
            stored_hash: storedHash,
            submitted_hash: hash_dokumen,
        };

        return JSON.stringify(result);
    }

    /**
     * transferOwnership transfers land ownership to new owner
     * Updates hash_pemilik, hash_dokumen, and cid_ipfs while preserving original metadata
     * @param ctx - transaction context
     * @param nomor_sertifikat - certificate number (unchanged)
     * @param hash_pemilik_baru - new owner identity hash
     * @param hash_dokumen_baru - new document hash
     * @param cid_ipfs_baru - new IPFS CID for new documents
     */
    async transferOwnership(ctx, nomor_sertifikat, hash_pemilik_baru, hash_dokumen_baru, cid_ipfs_baru) {
        // Validate all mandatory fields are provided
        const requiredFields = {
            hash_pemilik_baru,
            hash_dokumen_baru,
            cid_ipfs_baru,
        };

        for (const [field, value] of Object.entries(requiredFields)) {
            if (!value || value.trim() === '') {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        // Check if land asset exists
        const exists = await this._landAssetExists(ctx, nomor_sertifikat);
        if (!exists) {
            throw new Error(`Land asset ${nomor_sertifikat} does not exist`);
        }

        // Get current land asset
        const landAssetJSON = await ctx.stub.getState(nomor_sertifikat);
        const landAsset = JSON.parse(landAssetJSON.toString());

        if (landAsset.status !== 'ACTIVE') {
            throw new Error(`Land asset ${nomor_sertifikat} is not active`);
        }

        // Update ownership and document fields
        // Preserve: nomor_sertifikat, luas_tanah, lokasi_hash, created_at, status
        landAsset.hash_pemilik = hash_pemilik_baru;
        landAsset.hash_dokumen = hash_dokumen_baru;
        landAsset.cid_ipfs = cid_ipfs_baru;
        landAsset.updated_at = this._getTxTimestamp(ctx);

        // Store updated asset on same key for history tracking
        await ctx.stub.putState(
            nomor_sertifikat,
            Buffer.from(stringify(sortKeysRecursive(landAsset)))
        );

        return JSON.stringify(landAsset);
    }

    /**
     * getLandHistory retrieves the complete transaction history for a land asset
     * @param ctx - transaction context
     * @param nomor_sertifikat - certificate number
     */
    async getLandHistory(ctx, nomor_sertifikat) {
        const iterator = await ctx.stub.getHistoryForKey(nomor_sertifikat);

        const history = [];
        let result = await iterator.next();

        while (!result.done) {
            const historyRecord = {
                txId: result.value.tx_id,
                timestamp: new Date(result.value.timestamp.seconds * 1000).toISOString(),
                isDelete: result.value.is_delete,
                value: null,
            };

            if (!result.value.is_delete && result.value.value.length > 0) {
                try {
                    historyRecord.value = JSON.parse(result.value.value.toString());
                } catch (err) {
                    historyRecord.value = result.value.value.toString();
                }
            }

            history.push(historyRecord);
            result = await iterator.next();
        }

        await iterator.close();
        return JSON.stringify(history);
    }

    /**
     * getLandAsset retrieves complete land asset data
     * @param ctx - transaction context
     * @param nomor_sertifikat - certificate number
     */
    async getLandAsset(ctx, nomor_sertifikat) {
        const landAssetJSON = await ctx.stub.getState(nomor_sertifikat);

        if (!landAssetJSON || landAssetJSON.length === 0) {
            throw new Error(`Land asset ${nomor_sertifikat} does not exist`);
        }

        return landAssetJSON.toString();
    }

    /**
     * getAllLandAssets retrieves all land assets from the ledger
     * @param ctx - transaction context
     */
    async getAllLandAssets(ctx) {
        const allResults = [];
        const iterator = await ctx.stub.getStateByRange('', '');

        let result = await iterator.next();

        while (!result.done) {
            if (result.value && result.value.key) {
                const strValue = Buffer.from(result.value.value).toString('utf8');
                let record;
                try {
                    record = JSON.parse(strValue);
                } catch (err) {
                    record = strValue;
                }
                allResults.push({
                    key: result.value.key,
                    record,
                });
            }
            result = await iterator.next();
        }

        await iterator.close();
        return JSON.stringify(allResults);
    }

    // ============ Helper Functions ============

    /**
     * _landAssetExists checks if a land asset exists
     * @private
     */
    async _landAssetExists(ctx, nomor_sertifikat) {
        const landAssetJSON = await ctx.stub.getState(nomor_sertifikat);
        return landAssetJSON && landAssetJSON.length > 0;
    }

    /**
     * _getTxTimestamp retrieves transaction timestamp
     * Falls back to current time if tx timestamp not available
     * @private
     */
    _getTxTimestamp(ctx) {
        try {
            const txTimestamp = ctx.stub.getTxTimestamp();
            if (txTimestamp && txTimestamp.seconds) {
                return new Date(txTimestamp.seconds * 1000).toISOString();
            }
        } catch (err) {
            // Fallback to current time
        }
        return new Date().toISOString();
    }
}

module.exports = SIPEVITAContract;
