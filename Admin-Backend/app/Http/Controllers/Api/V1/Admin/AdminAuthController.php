<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Actions\RegisterInitialCatalogManager;
use App\Http\Controllers\Controller;
use App\Http\Requests\RegisterInitialAdminRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use App\Models\User;

class AdminAuthController extends Controller
{
    public function csrf(Request $request): JsonResponse
    {
        return response()->json(['data' => ['csrf_token' => csrf_token()]]);
    }

    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        if (! Auth::attempt($credentials)) {
            throw ValidationException::withMessages(['email' => ['The provided credentials are incorrect.']]);
        }

        $request->session()->regenerate();

        return response()->json(['data' => ['user' => $this->userPayload($request->user())]]);
    }

    public function register(RegisterInitialAdminRequest $request, RegisterInitialCatalogManager $registerInitialCatalogManager): JsonResponse
    {
        try {
            $user = $registerInitialCatalogManager->execute($request->safe()->only(['name', 'email', 'password']));
        } catch (\LogicException $exception) {
            return response()->json([
                'error' => [
                    'code' => 'admin.setup_closed',
                    'message' => $exception->getMessage(),
                ],
            ], 409);
        }

        Auth::login($user);
        $request->session()->regenerate();

        return response()->json([
            'data' => ['user' => $this->userPayload($user)],
        ], 201);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(status: 204);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['data' => ['user' => $this->userPayload($request->user())]]);
    }

    /** @return array{id: string, name: string, email: string, permissions: list<string>} */
    private function userPayload(User $user): array
    {
        $permissions = $user->roles()
            ->with('permissions:id,name')
            ->get()
            ->flatMap(fn ($role) => $role->permissions->pluck('name'))
            ->unique()
            ->sort()
            ->values()
            ->all();

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'permissions' => $permissions,
        ];
    }
}
