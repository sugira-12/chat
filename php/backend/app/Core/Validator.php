<?php
namespace App\Core;

class Validator
{
    public static function validate(array $data, array $rules): array
    {
        $errors = [];
        foreach ($rules as $field => $ruleString) {
            $rulesList = explode('|', $ruleString);
            $value = $data[$field] ?? null;
            foreach ($rulesList as $rule) {
                [$name, $param] = array_pad(explode(':', $rule, 2), 2, null);
                if ($name === 'required' && ($value === null || $value === '')) {
                    $errors[$field][] = 'required';
                }
                if ($name === 'email' && $value && !filter_var($value, FILTER_VALIDATE_EMAIL)) {
                    $errors[$field][] = 'email';
                }
                if ($name === 'min' && $value !== null && strlen($value) < (int)$param) {
                    $errors[$field][] = 'min';
                }
                if ($name === 'max' && $value !== null && strlen($value) > (int)$param) {
                    $errors[$field][] = 'max';
                }
            }
        }
        return $errors;
    }
}
