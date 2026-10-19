<?php

namespace App\Console\Commands;

use App\Models\Role;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use InvalidArgumentException;

class ProvisionCatalogManager extends Command
{
    protected $signature = 'durafit:provision-catalog-manager {email : Administrator email address} {--name= : Administrator display name} {--password= : Password; omit to enter it securely}';

    protected $description = 'Creates or updates a user and assigns the catalog-manager role.';

    public function handle(): int
    {
        $email = (string) $this->argument('email');
        $name = (string) ($this->option('name') ?: $this->ask('Display name'));
        $password = (string) ($this->option('password') ?: $this->secret('Password'));

        if ($name === '' || $password === '') {
            throw new InvalidArgumentException('A display name and password are required.');
        }

        $role = Role::query()->where('slug', 'catalog-manager')->sole();
        $user = User::query()->firstOrNew(['email' => $email]);
        $user->fill(['name' => $name, 'password' => Hash::make($password)]);
        $user->save();
        $user->roles()->syncWithoutDetaching([$role->id]);

        $this->info("Catalog manager provisioned for {$user->email}.");

        return self::SUCCESS;
    }
}
