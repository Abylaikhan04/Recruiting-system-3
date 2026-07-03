<?php

namespace App\Models\Concerns;

use App\Models\ActionLog;

/**
 * Writes a simple audit trail (action_logs) whenever the model is created,
 * updated, or (soft-)deleted. Attach to models that need auditing.
 */
trait Auditable
{
    protected static function bootAuditable(): void
    {
        static::created(function ($model) {
            static::writeActionLog('created', $model);
        });

        static::updated(function ($model) {
            static::writeActionLog('updated', $model);
        });

        static::deleted(function ($model) {
            static::writeActionLog('deleted', $model);
        });
    }

    protected static function writeActionLog(string $action, $model): void
    {
        ActionLog::create([
            'user_id' => auth()->id(),
            'action' => $action,
            'model_type' => static::class,
            'model_id' => $model->getKey(),
        ]);
    }
}
